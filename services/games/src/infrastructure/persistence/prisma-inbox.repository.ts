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
import { RoundPhase } from "../../domain/entities/round";
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

      // A Pending bet whose Round already left Betting slipped past the void sweep; void it here so
      // this confirmation is the authoritative deadline check and the VOIDED branch issues the refund.
      if (bet.status === BetStatus.PENDING) {
        const round = await tx.round.findUnique({
          where: { roundNumber: bet.roundNumber },
          select: { phase: true },
        });
        if (round?.phase === RoundPhase.BETTING) {
          bet.confirm({ confirmedAt: new Date() });
          await tx.bet.update({
            where: { betId },
            data: { status: bet.status, confirmedAt: bet.confirmedAt },
          });
          return { kind: "confirmed", bet };
        }
        bet.void();
        await tx.bet.update({ where: { betId }, data: { status: bet.status } });
      }

      // Stake already left the wallet; compensate with a Refund enqueued in this same transaction (ADR-0001).
      if (bet.status === BetStatus.VOIDED) {
        const refund = buildRefund({
          betId: bet.betId,
          playerId: bet.playerId,
          stakeCents: Number(bet.stake.cents),
        });
        await tx.outboxMessage.create({ data: toOutboxData(refund) });
        return { kind: "refunded", betId: bet.betId };
      }

      // Terminal state: the inbox key still commits so the message is not reprocessed.
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
      // If already Voided, leave it: a rejected debit moved no money, so there is nothing to undo.
      if (bet.status !== BetStatus.PENDING) {
        return null;
      }
      bet.reject();
      await tx.bet.update({ where: { betId }, data: { status: bet.status } });
      return bet;
    });
  }

  // Scoped to this insert only: a unique violation elsewhere in the transaction propagates as a real error.
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
