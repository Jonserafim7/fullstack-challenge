import { Injectable } from "@nestjs/common";
import { Money } from "@crash/money";
import { Prisma } from "../../../generated/prisma/client";
import { DuplicateMessageError } from "../../application/errors/duplicate-message.error";
import { InboxStore } from "../../application/messaging/inbox-store";
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
  }: {
    messageKey: string;
    type: string;
    betId: string;
  }): Promise<Bet | null> {
    return this.prisma.$transaction(async (tx) => {
      try {
        await tx.inboxMessage.create({ data: { messageKey, type } });
      } catch (error) {
        if (isDuplicateKey(error)) {
          throw new DuplicateMessageError(messageKey);
        }
        throw error;
      }

      const row = await tx.bet.findUnique({ where: { betId } });
      if (!row) {
        return null;
      }
      const bet = toDomain(row);
      // The Pending -> Confirmed rule stays in the domain. A reply for a Bet that is no longer
      // Pending is a no-op (nothing to broadcast); the inbox key still commits, so it is not
      // reprocessed.
      if (bet.status !== BetStatus.PENDING) {
        return null;
      }
      bet.confirm({ confirmedAt: new Date() });
      await tx.bet.update({
        where: { betId },
        data: { status: bet.status, confirmedAt: bet.confirmedAt },
      });
      return bet;
    });
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

function isDuplicateKey(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  );
}
