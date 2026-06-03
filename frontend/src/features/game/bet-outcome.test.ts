import { describe, expect, test } from "bun:test";
import { deriveBetOutcome } from "./bet-outcome";
import { BetStatus, RoundPhase } from "./round-contracts";

describe("deriveBetOutcome", () => {
  test("a Confirmed bet is Lost once the Round is terminal", () => {
    expect(
      deriveBetOutcome({
        status: BetStatus.CONFIRMED,
        phase: RoundPhase.CRASHED,
      }).isLost,
    ).toBe(true);
    expect(
      deriveBetOutcome({
        status: BetStatus.CONFIRMED,
        phase: RoundPhase.SETTLED,
      }).isLost,
    ).toBe(true);
  });

  test("a Confirmed bet during Running is neither Lost nor Voided", () => {
    const outcome = deriveBetOutcome({
      status: BetStatus.CONFIRMED,
      phase: RoundPhase.RUNNING,
    });
    expect(outcome.isConfirmed).toBe(true);
    expect(outcome.isRunning).toBe(true);
    expect(outcome.isLost).toBe(false);
    expect(outcome.isVoided).toBe(false);
  });

  test("a still-Pending bet is Voided once Betting has closed", () => {
    expect(
      deriveBetOutcome({ status: BetStatus.PENDING, phase: RoundPhase.RUNNING })
        .isVoided,
    ).toBe(true);
    expect(
      deriveBetOutcome({ status: BetStatus.PENDING, phase: RoundPhase.CRASHED })
        .isVoided,
    ).toBe(true);
  });

  test("a Pending bet during Betting is not yet Voided", () => {
    expect(
      deriveBetOutcome({ status: BetStatus.PENDING, phase: RoundPhase.BETTING })
        .isVoided,
    ).toBe(false);
  });

  test("an explicitly Voided bet reads as Voided regardless of phase", () => {
    expect(
      deriveBetOutcome({ status: BetStatus.VOIDED, phase: RoundPhase.BETTING })
        .isVoided,
    ).toBe(true);
  });
});
