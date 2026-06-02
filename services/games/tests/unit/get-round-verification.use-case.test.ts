import { describe, test, expect } from "bun:test";
import { RoundNotVerifiableError } from "../../src/application/errors/round-not-verifiable.error";
import type { RoundRepository } from "../../src/application/repositories/round.repository";
import { GetRoundVerificationUseCase } from "../../src/application/use-cases/get-round-verification.use-case";
import { Round, RoundPhase } from "../../src/domain/entities/round";

function repoReturning(round: Round | null): RoundRepository {
  return {
    save: async () => {},
    findCurrent: async () => null,
    findByNumber: async () => round,
    findHistory: async () => ({ rounds: [], total: 0 }),
    maxRoundNumber: async () => 0,
  };
}

function roundAt(phase: RoundPhase): Round {
  return Round.restore({
    roundNumber: 5,
    crashPointHundredths: 247,
    serverSeed: "server-seed-5",
    clientSeed: "crash-game",
    houseEdge: 0.01,
    seedHash: "server-seed-4",
    phase,
    bettingEndsAt: new Date("2026-01-01T00:00:05Z"),
    startedAt: phase === RoundPhase.BETTING ? null : new Date(),
    crashedAt:
      phase === RoundPhase.CRASHED || phase === RoundPhase.SETTLED
        ? new Date()
        : null,
  });
}

describe("GetRoundVerificationUseCase", () => {
  test("returns a crashed Round with its revealed seeds and chained Commitment", async () => {
    const useCase = new GetRoundVerificationUseCase(
      repoReturning(roundAt(RoundPhase.CRASHED)),
    );

    const round = await useCase.execute({ roundNumber: 5 });

    expect(round).not.toBeNull();
    expect(round!.serverSeed).toBe("server-seed-5");
    expect(round!.seedHash).toBe("server-seed-4");
    expect(round!.crashPointHundredths).toBe(247);
  });

  test("verifies a Settled Round too (also terminal)", async () => {
    const useCase = new GetRoundVerificationUseCase(
      repoReturning(roundAt(RoundPhase.SETTLED)),
    );

    const round = await useCase.execute({ roundNumber: 5 });

    expect(round!.serverSeed).toBe("server-seed-5");
  });

  test("refuses to reveal the seed of a Round still Betting", async () => {
    const useCase = new GetRoundVerificationUseCase(
      repoReturning(roundAt(RoundPhase.BETTING)),
    );

    await expect(useCase.execute({ roundNumber: 5 })).rejects.toBeInstanceOf(
      RoundNotVerifiableError,
    );
  });

  test("refuses to reveal the seed of a Round still Running", async () => {
    const useCase = new GetRoundVerificationUseCase(
      repoReturning(roundAt(RoundPhase.RUNNING)),
    );

    await expect(useCase.execute({ roundNumber: 5 })).rejects.toBeInstanceOf(
      RoundNotVerifiableError,
    );
  });

  test("resolves to null when no such Round exists", async () => {
    const useCase = new GetRoundVerificationUseCase(repoReturning(null));

    expect(await useCase.execute({ roundNumber: 999 })).toBeNull();
  });
});
