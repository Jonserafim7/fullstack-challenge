import { describe, test, expect } from "bun:test";
import { Money } from "@crash/money";
import type { BetRepository } from "../../src/application/repositories/bet.repository";
import { GetBetHistoryUseCase } from "../../src/application/use-cases/get-bet-history.use-case";
import { Bet } from "../../src/domain/entities/bet";

interface FindByPlayerCall {
  playerId: string;
  limit: number;
  offset: number;
}

function fakeBets(result: { bets: Bet[]; total: number }): {
  bets: BetRepository;
  calls: FindByPlayerCall[];
} {
  const calls: FindByPlayerCall[] = [];
  const bets = {
    findByPlayer: async (call: FindByPlayerCall) => {
      calls.push(call);
      return result;
    },
  } as unknown as BetRepository;
  return { bets, calls };
}

function aBet(roundNumber: number): Bet {
  return Bet.place({
    betId: `bet-${roundNumber}`,
    roundNumber,
    playerId: "player-1",
    username: "player",
    stake: Money.fromCents(500),
  });
}

describe("GetBetHistory", () => {
  test("translates page/pageSize into limit/offset, scoped to the player", async () => {
    const { bets, calls } = fakeBets({ bets: [], total: 0 });
    const useCase = new GetBetHistoryUseCase(bets);

    await useCase.execute({ playerId: "player-1", page: 3, pageSize: 20 });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ playerId: "player-1", limit: 20, offset: 40 });
  });

  test("offset is zero on the first page", async () => {
    const { bets, calls } = fakeBets({ bets: [], total: 0 });
    const useCase = new GetBetHistoryUseCase(bets);

    await useCase.execute({ playerId: "player-1", page: 1, pageSize: 50 });

    expect(calls[0]).toEqual({ playerId: "player-1", limit: 50, offset: 0 });
  });

  test("passes through the page of bets and the total count", async () => {
    const page = [aBet(42), aBet(41)];
    const { bets } = fakeBets({ bets: page, total: 137 });
    const useCase = new GetBetHistoryUseCase(bets);

    const result = await useCase.execute({
      playerId: "player-1",
      page: 1,
      pageSize: 20,
    });

    expect(result.bets).toBe(page);
    expect(result.total).toBe(137);
  });
});
