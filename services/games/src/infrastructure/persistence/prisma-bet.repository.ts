import { Injectable } from "@nestjs/common";
import { Money } from "@crash/money";
import { Prisma } from "../../../generated/prisma/client";
import { BetAlreadyPlacedError } from "../../application/errors/bet-already-placed.error";
import { NewOutboxMessage } from "../../application/messaging/outbox-store";
import { BetRepository } from "../../application/repositories/bet.repository";
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
export class PrismaBetRepository implements BetRepository {
  constructor(private readonly prisma: PrismaService) {}

  async place({
    bet,
    debitMessage,
  }: {
    bet: Bet;
    debitMessage: NewOutboxMessage;
  }): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.bet.create({ data: toCreateData(bet) });
        await tx.outboxMessage.create({ data: toOutboxData(debitMessage) });
      });
    } catch (error) {
      // The only constraint a caller can violate here is the one-bet-per-Round unique; the debit
      // message_key is `debit:{fresh betId}`, which never collides.
      if (isDuplicateKey(error)) {
        throw new BetAlreadyPlacedError();
      }
      throw error;
    }
  }

  async findById(betId: string): Promise<Bet | null> {
    const row = await this.prisma.bet.findUnique({ where: { betId } });
    return row ? toDomain(row) : null;
  }

  async findByRoundAndPlayer({
    roundNumber,
    playerId,
  }: {
    roundNumber: number;
    playerId: string;
  }): Promise<Bet | null> {
    const row = await this.prisma.bet.findUnique({
      where: { roundNumber_playerId: { roundNumber, playerId } },
    });
    return row ? toDomain(row) : null;
  }

  async cashOut({
    bet,
    payoutMessage,
  }: {
    bet: Bet;
    payoutMessage: NewOutboxMessage;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.bet.update({
        where: { betId: bet.betId },
        data: {
          status: bet.status,
          cashedOutMultiplier: bet.cashedOutMultiplier,
          cashedOutAt: bet.cashedOutAt,
        },
      });
      await tx.outboxMessage.create({ data: toOutboxData(payoutMessage) });
    });
  }

  async markConfirmedAsLost({
    roundNumber,
  }: {
    roundNumber: number;
  }): Promise<number> {
    const { count } = await this.prisma.bet.updateMany({
      where: { roundNumber, status: BetStatus.CONFIRMED },
      data: { status: BetStatus.LOST },
    });
    return count;
  }

  async markPendingAsVoided({
    roundNumber,
  }: {
    roundNumber: number;
  }): Promise<number> {
    const { count } = await this.prisma.bet.updateMany({
      where: { roundNumber, status: BetStatus.PENDING },
      data: { status: BetStatus.VOIDED },
    });
    return count;
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

function toCreateData(bet: Bet): Prisma.BetCreateInput {
  return {
    betId: bet.betId,
    roundNumber: bet.roundNumber,
    playerId: bet.playerId,
    username: bet.username,
    stake: bet.stake.cents,
    status: bet.status,
    confirmedAt: bet.confirmedAt,
  };
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
