import { Injectable } from "@nestjs/common";
import { RoundRepository } from "../../application/repositories/round.repository";
import { Round, RoundPhase } from "../../domain/entities/round";
import { PrismaService } from "./prisma.service";

interface RoundRow {
  roundNumber: number;
  phase: string;
  crashPoint: number;
  serverSeed: string;
  clientSeed: string;
  houseEdge: number;
  seedHash: string | null;
  bettingEndsAt: Date | null;
  startedAt: Date | null;
  crashedAt: Date | null;
}

const TERMINAL_PHASES: RoundPhase[] = [RoundPhase.CRASHED, RoundPhase.SETTLED];

@Injectable()
export class PrismaRoundRepository implements RoundRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(round: Round): Promise<void> {
    const row = toPersistence(round);
    await this.prisma.round.upsert({
      where: { roundNumber: row.roundNumber },
      create: row,
      update: {
        phase: row.phase,
        bettingEndsAt: row.bettingEndsAt,
        startedAt: row.startedAt,
        crashedAt: row.crashedAt,
      },
    });
  }

  async findCurrent(): Promise<Round | null> {
    const row = await this.prisma.round.findFirst({
      orderBy: { roundNumber: "desc" },
    });
    return row ? toDomain(row) : null;
  }

  async findByNumber(roundNumber: number): Promise<Round | null> {
    const row = await this.prisma.round.findUnique({ where: { roundNumber } });
    return row ? toDomain(row) : null;
  }

  async findHistory({
    limit,
    offset,
  }: {
    limit: number;
    offset: number;
  }): Promise<{ rounds: Round[]; total: number }> {
    const where = { phase: { in: TERMINAL_PHASES } };
    const [rows, total] = await Promise.all([
      this.prisma.round.findMany({
        where,
        orderBy: { roundNumber: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.round.count({ where }),
    ]);
    return { rounds: rows.map(toDomain), total };
  }

  async maxRoundNumber(): Promise<number> {
    const row = await this.prisma.round.findFirst({
      orderBy: { roundNumber: "desc" },
      select: { roundNumber: true },
    });
    return row?.roundNumber ?? 0;
  }
}

function toDomain(row: RoundRow): Round {
  return Round.restore({
    roundNumber: row.roundNumber,
    crashPointHundredths: row.crashPoint,
    serverSeed: row.serverSeed,
    clientSeed: row.clientSeed,
    houseEdge: row.houseEdge,
    seedHash: row.seedHash,
    phase: row.phase as RoundPhase,
    bettingEndsAt: row.bettingEndsAt,
    startedAt: row.startedAt,
    crashedAt: row.crashedAt,
  });
}

function toPersistence(round: Round): RoundRow {
  return {
    roundNumber: round.roundNumber,
    phase: round.phase,
    crashPoint: round.crashPointHundredths,
    serverSeed: round.serverSeed,
    clientSeed: round.clientSeed,
    houseEdge: round.houseEdge,
    seedHash: round.seedHash,
    bettingEndsAt: round.bettingEndsAt,
    startedAt: round.startedAt,
    crashedAt: round.crashedAt,
  };
}
