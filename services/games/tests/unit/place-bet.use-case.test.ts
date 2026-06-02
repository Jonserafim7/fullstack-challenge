import { describe, test, expect } from "bun:test";
import {
  debitKey,
  MessageType,
  RoutingKey,
  type DebitCommandPayload,
} from "@crash/messaging";
import { BetAlreadyPlacedError } from "../../src/application/errors/bet-already-placed.error";
import { BettingClosedError } from "../../src/application/errors/betting-closed.error";
import { InvalidStakeError } from "../../src/application/errors/invalid-stake.error";
import type { NewOutboxMessage } from "../../src/application/messaging/outbox-store";
import type { BetRepository } from "../../src/application/repositories/bet.repository";
import type { RoundRepository } from "../../src/application/repositories/round.repository";
import { PlaceBetUseCase } from "../../src/application/use-cases/place-bet.use-case";
import { Bet, BetStatus } from "../../src/domain/entities/bet";
import { Round, RoundPhase } from "../../src/domain/entities/round";

function bettingRound(): Round {
  return Round.open({
    roundNumber: 42,
    crashPointHundredths: 247,
    serverSeed: "s",
    clientSeed: "c",
    houseEdge: 0.01,
    seedHash: "h",
    bettingEndsAt: new Date("2026-01-01T00:00:05Z"),
  });
}

function runningRound(): Round {
  return Round.restore({
    roundNumber: 42,
    crashPointHundredths: 247,
    serverSeed: "s",
    clientSeed: "c",
    houseEdge: 0.01,
    seedHash: "h",
    phase: RoundPhase.RUNNING,
    bettingEndsAt: new Date("2026-01-01T00:00:05Z"),
    startedAt: new Date("2026-01-01T00:00:05Z"),
    crashedAt: null,
  });
}

function fakeRounds(current: Round | null): RoundRepository {
  return {
    findCurrent: async (): Promise<Round | null> => current,
  } as unknown as RoundRepository;
}

interface PlacedCall {
  bet: Bet;
  debitMessage: NewOutboxMessage;
}

function fakeBets(options?: { throwOnPlace?: Error }): {
  bets: BetRepository;
  placed: PlacedCall[];
} {
  const placed: PlacedCall[] = [];
  const bets = {
    place: async (call: PlacedCall): Promise<void> => {
      if (options?.throwOnPlace) {
        throw options.throwOnPlace;
      }
      placed.push(call);
    },
  } as unknown as BetRepository;
  return { bets, placed };
}

describe("PlaceBet", () => {
  test("places a Pending Bet and enqueues a wallet.debit during Betting", async () => {
    const { bets, placed } = fakeBets();
    const useCase = new PlaceBetUseCase(fakeRounds(bettingRound()), bets);

    const bet = await useCase.execute({
      playerId: "player-1",
      username: "player",
      stakeCents: 500,
    });

    expect(bet.status).toBe(BetStatus.PENDING);
    expect(bet.roundNumber).toBe(42);
    expect(placed).toHaveLength(1);

    const message = placed[0]!.debitMessage;
    expect(message.type).toBe(MessageType.WALLET_DEBIT);
    expect(message.routingKey).toBe(RoutingKey.WALLET_DEBIT);
    expect(message.messageKey).toBe(debitKey(bet.betId));
    expect(message.payload as DebitCommandPayload).toEqual({
      betId: bet.betId,
      playerId: "player-1",
      stakeCents: 500,
    });
  });

  test("rejects a bet when no Round exists yet", async () => {
    const { bets, placed } = fakeBets();
    const useCase = new PlaceBetUseCase(fakeRounds(null), bets);

    await expect(
      useCase.execute({ playerId: "p", username: "u", stakeCents: 500 }),
    ).rejects.toThrow(BettingClosedError);
    expect(placed).toHaveLength(0);
  });

  test("rejects a bet once the Round has left Betting", async () => {
    const { bets, placed } = fakeBets();
    const useCase = new PlaceBetUseCase(fakeRounds(runningRound()), bets);

    await expect(
      useCase.execute({ playerId: "p", username: "u", stakeCents: 500 }),
    ).rejects.toThrow(BettingClosedError);
    expect(placed).toHaveLength(0);
  });

  test("surfaces a duplicate placement as BetAlreadyPlacedError", async () => {
    const { bets } = fakeBets({ throwOnPlace: new BetAlreadyPlacedError() });
    const useCase = new PlaceBetUseCase(fakeRounds(bettingRound()), bets);

    await expect(
      useCase.execute({ playerId: "p", username: "u", stakeCents: 500 }),
    ).rejects.toThrow(BetAlreadyPlacedError);
  });

  test("rejects a stake outside the allowed range, before touching any Round", async () => {
    const { bets, placed } = fakeBets();
    const useCase = new PlaceBetUseCase(fakeRounds(bettingRound()), bets);

    for (const stakeCents of [99, 100001, 100.5]) {
      await expect(
        useCase.execute({ playerId: "p", username: "u", stakeCents }),
      ).rejects.toThrow(InvalidStakeError);
    }
    expect(placed).toHaveLength(0);
  });
});
