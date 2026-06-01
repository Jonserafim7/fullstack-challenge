import { describe, test, expect } from "bun:test";
import type { BetRepository } from "../../src/application/repositories/bet.repository";
import { VoidPendingBetsUseCase } from "../../src/application/use-cases/void-pending-bets.use-case";

interface VoidCall {
  roundNumber: number;
}

function fakeBets(voidedCount: number): {
  bets: BetRepository;
  calls: VoidCall[];
} {
  const calls: VoidCall[] = [];
  const bets = {
    markPendingAsVoided: async (call: VoidCall): Promise<number> => {
      calls.push(call);
      return voidedCount;
    },
  } as unknown as BetRepository;
  return { bets, calls };
}

describe("VoidPendingBets", () => {
  test("voids every still-Pending bet on the Round", async () => {
    const { bets, calls } = fakeBets(2);
    const useCase = new VoidPendingBetsUseCase(bets);

    await useCase.execute({ roundNumber: 42 });

    expect(calls).toEqual([{ roundNumber: 42 }]);
  });

  test("is a no-op-safe when no Pending bets remain", async () => {
    const { bets, calls } = fakeBets(0);
    const useCase = new VoidPendingBetsUseCase(bets);

    await expect(useCase.execute({ roundNumber: 7 })).resolves.toBeUndefined();
    expect(calls).toEqual([{ roundNumber: 7 }]);
  });
});
