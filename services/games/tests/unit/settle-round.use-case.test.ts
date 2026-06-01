import { describe, test, expect } from "bun:test";
import type { BetRepository } from "../../src/application/repositories/bet.repository";
import { SettleRoundUseCase } from "../../src/application/use-cases/settle-round.use-case";

interface MarkLostCall {
  roundNumber: number;
}

function fakeBets(lostCount: number): {
  bets: BetRepository;
  calls: MarkLostCall[];
} {
  const calls: MarkLostCall[] = [];
  const bets = {
    markConfirmedAsLost: async (call: MarkLostCall): Promise<number> => {
      calls.push(call);
      return lostCount;
    },
  } as unknown as BetRepository;
  return { bets, calls };
}

describe("SettleRound", () => {
  test("marks every still-Confirmed bet on the Round as Lost", async () => {
    const { bets, calls } = fakeBets(3);
    const useCase = new SettleRoundUseCase(bets);

    await useCase.execute({ roundNumber: 42 });

    expect(calls).toEqual([{ roundNumber: 42 }]);
  });

  test("is a no-op-safe when no Confirmed bets remain", async () => {
    const { bets, calls } = fakeBets(0);
    const useCase = new SettleRoundUseCase(bets);

    await expect(useCase.execute({ roundNumber: 7 })).resolves.toBeUndefined();
    expect(calls).toEqual([{ roundNumber: 7 }]);
  });
});
