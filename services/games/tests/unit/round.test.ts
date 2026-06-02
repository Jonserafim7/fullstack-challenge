import { describe, test, expect } from "bun:test";
import { Round, RoundPhase } from "../../src/domain/entities/round";
import { InvalidRoundTransitionError } from "../../src/domain/errors/invalid-round-transition.error";

function openRound(): Round {
  return Round.open({
    roundNumber: 1,
    crashPointHundredths: 247,
    serverSeed: "server-seed",
    clientSeed: "client-seed",
    houseEdge: 0.01,
    seedHash: "seed-hash",
    bettingEndsAt: new Date("2026-01-01T00:00:05Z"),
  });
}

describe("Round", () => {
  test("opens in the Betting phase with the Crash Point fixed", () => {
    const round = openRound();

    expect(round.phase).toBe(RoundPhase.BETTING);
    expect(round.crashPointHundredths).toBe(247);
    expect(round.bettingEndsAt).toEqual(new Date("2026-01-01T00:00:05Z"));
    expect(round.isTerminal).toBe(false);
  });

  test("advances Betting -> Running -> Crashed -> Settled", () => {
    const round = openRound();

    round.startRunning({ startedAt: new Date("2026-01-01T00:00:05Z") });
    expect(round.phase).toBe(RoundPhase.RUNNING);
    expect(round.startedAt).toEqual(new Date("2026-01-01T00:00:05Z"));

    round.crash({ crashedAt: new Date("2026-01-01T00:00:10Z") });
    expect(round.phase).toBe(RoundPhase.CRASHED);
    expect(round.crashedAt).toEqual(new Date("2026-01-01T00:00:10Z"));
    expect(round.isTerminal).toBe(true);

    round.settle();
    expect(round.phase).toBe(RoundPhase.SETTLED);
    expect(round.isTerminal).toBe(true);
  });

  test("rejects starting a Round that is not Betting", () => {
    const round = openRound();
    round.startRunning({ startedAt: new Date() });

    expect(() => round.startRunning({ startedAt: new Date() })).toThrow(
      InvalidRoundTransitionError,
    );
  });

  test("rejects crashing a Round that is not Running", () => {
    const round = openRound();

    expect(() => round.crash({ crashedAt: new Date() })).toThrow(
      InvalidRoundTransitionError,
    );
  });

  test("rejects settling a Round that has not Crashed", () => {
    const round = openRound();
    round.startRunning({ startedAt: new Date() });

    expect(() => round.settle()).toThrow(InvalidRoundTransitionError);
  });

  test("restores a Round from persistence at its stored phase", () => {
    const round = Round.restore({
      roundNumber: 7,
      crashPointHundredths: 150,
      serverSeed: "s",
      clientSeed: "c",
      houseEdge: 0.01,
      seedHash: "seed-hash",
      phase: RoundPhase.RUNNING,
      bettingEndsAt: new Date("2026-01-01T00:00:05Z"),
      startedAt: new Date("2026-01-01T00:00:05Z"),
      crashedAt: null,
    });

    expect(round.phase).toBe(RoundPhase.RUNNING);
    expect(round.roundNumber).toBe(7);

    round.crash({ crashedAt: new Date("2026-01-01T00:00:09Z") });
    expect(round.phase).toBe(RoundPhase.CRASHED);
  });
});
