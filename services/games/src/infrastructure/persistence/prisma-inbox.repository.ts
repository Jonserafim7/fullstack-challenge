import { Injectable } from "@nestjs/common";
import { Money } from "@crash/money";
import { Prisma } from "../../../generated/prisma/client";
import { DuplicateMessageError } from "../../application/errors/duplicate-message.error";
import {
  ConfirmationResult,
  InboxStore,
  RefundableBet,
} from "../../application/messaging/inbox-store";
import { NewOutboxMessage } from "../../application/messaging/outbox-store";
import { Bet, BetStatus } from "../../domain/entities/bet";
import { PrismaService } from "./prisma.service";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

interface BetRow {
  betId: string;
  roundNumber: number;
  playerId: string;
  username: string;
  stake: bigint;
  status: string;
  confirmedAt: Date | null;
  cashedOutMultiplier: number | null;
  cashedOutAt: Date | null;
}

@Injectable()
export class PrismaInboxRepository implements InboxStore {
  constructor(private readonly prisma: PrismaService) {}

  async recordConfirmation({
    messageKey,
    type,
    betId,
    buildRefund,
  }: {
    messageKey: string;
    type: string;
    betId: string;
    buildRefund: (bet: RefundableBet) => NewOutboxMessage;
  }): Promise<ConfirmationResult> {
    return this.prisma.$transaction(async (tx) => {
      await this.recordKey(tx, { messageKey, type });

      const row = await tx.bet.findUnique({ where: { betId } });
      if (!row) {
        return { kind: "ignored" };
      }
      const bet = toDomain(row);

      // The Pending -> Confirmed rule stays in the domain.
      if (bet.status === BetStatus.PENDING) {
        bet.confirm({ confirmedAt: new Date() });
        await tx.bet.update({
          where: { betId },
          data: { status: bet.status, confirmedAt: bet.confirmedAt },
        });
        return { kind: "confirmed", bet };
      }

      // The Bet was Voided (its betting window closed before this debit landed), yet the stake left
      // the wallet — so compensate with a Refund (ADR-0001). Enqueued in this same transaction as
      // the dedup key, so the refund and the key commit together; the refund's `refund:{betId}` key
      // makes a redelivery a no-op on both ends.
      if (bet.status === BetStatus.VOIDED) {
        const refund = buildRefund({
          betId: bet.betId,
          playerId: bet.playerId,
          stakeCents: Number(bet.stake.cents),
        });
        await tx.outboxMessage.create({ data: toOutboxData(refund) });
        return { kind: "refunded", betId: bet.betId };
      }

      // Any other state (already Confirmed/Cashed Out/Lost/Rejected) is a no-op; the inbox key still
      // commits so the message is not reprocessed.
      return { kind: "ignored" };
    });
  }

  async recordRejection({
    messageKey,
    type,
    betId,
  }: {
    messageKey: string;
    type: string;
    betId: string;
  }): Promise<Bet | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.recordKey(tx, { messageKey, type });

      const row = await tx.bet.findUnique({ where: { betId } });
      if (!row) {
        return null;
      }
      const bet = toDomain(row);
      // Only a Pending bet becomes Rejected. If it is already Voided (the Round moved on before the
      // rejection arrived), leave it — a rejected debit moved no money, so there is nothing to undo.
      if (bet.status !== BetStatus.PENDING) {
        return null;
      }
      bet.reject();
      await tx.bet.update({ where: { betId }, data: { status: bet.status } });
      return bet;
    });
  }

  // The dedup is the inbox primary key alone. Scoping the duplicate check to this insert means a
  // unique-constraint failure elsewhere in the transaction (a real anomaly) propagates instead of
  // being mistaken for a redelivery and silently swallowed.
  private async recordKey(
    tx: Prisma.TransactionClient,
    { messageKey, type }: { messageKey: string; type: string },
  ): Promise<void> {
    try {
      await tx.inboxMessage.create({ data: { messageKey, type } });
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new DuplicateMessageError(messageKey);
      }
      throw error;
    }
  }
}

function toDomain(row: BetRow): Bet {
  return Bet.restore({
    betId: row.betId,
    roundNumber: row.roundNumber,
    playerId: row.playerId,
    username: row.username,
    stake: Money.fromCents(row.stake),
    status: row.status as BetStatus,
    confirmedAt: row.confirmedAt,
    cashedOutMultiplier: row.cashedOutMultiplier,
    cashedOutAt: row.cashedOutAt,
  });
}

function toOutboxData(
  message: NewOutboxMessage,
): Prisma.OutboxMessageCreateInput {
  return {
    messageKey: message.messageKey,
    type: message.type,
    routingKey: message.routingKey,
    payload: message.payload as Prisma.InputJsonValue,
  };
}

function isDuplicateKey(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  );
}
