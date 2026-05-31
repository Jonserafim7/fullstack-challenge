import { describe, test, expect } from "bun:test";
import {
  GROWTH_RATE_PER_SECOND,
  multiplierAt,
  elapsedMsToReach,
} from "../../src/curve";

describe("crash curve", () => {
  test("starts at 1.00x when no time has elapsed", () => {
    expect(multiplierAt({ elapsedMs: 0 })).toBe(1);
  });

  test("rises strictly as time elapses", () => {
    const early = multiplierAt({ elapsedMs: 1000 });
    const later = multiplierAt({ elapsedMs: 2000 });

    expect(early).toBeGreaterThan(1);
    expect(later).toBeGreaterThan(early);
  });

  test("matches e^(rate * seconds)", () => {
    const elapsedMs = 5000;

    expect(multiplierAt({ elapsedMs })).toBeCloseTo(
      Math.exp(GROWTH_RATE_PER_SECOND * 5),
      10,
    );
  });

  test("inverse round-trips a multiplier back to itself", () => {
    const multiplier = 2.47;

    const reached = multiplierAt({
      elapsedMs: elapsedMsToReach({ multiplier }),
    });

    expect(reached).toBeCloseTo(multiplier, 8);
  });

  test("inverse round-trips an elapsed time back to itself", () => {
    const elapsedMs = 7321;

    const sameElapsed = elapsedMsToReach({
      multiplier: multiplierAt({ elapsedMs }),
    });

    expect(sameElapsed).toBeCloseTo(elapsedMs, 6);
  });

  test("reaches 1.00x or lower at t = 0", () => {
    expect(elapsedMsToReach({ multiplier: 1 })).toBe(0);
    expect(elapsedMsToReach({ multiplier: 0.5 })).toBe(0);
  });
});
