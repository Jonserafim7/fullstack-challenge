import { describe, expect, test } from "bun:test";
import { nextRetry } from "../../src/application/messaging/retry-policy";

describe("nextRetry", () => {
  test("doubles the delay each attempt while under the cap", () => {
    expect(nextRetry({ attempt: 0, baseMs: 1000, maxAttempts: 5 })).toEqual({
      shouldRetry: true,
      delayMs: 1000,
      nextAttempt: 1,
    });
    expect(nextRetry({ attempt: 1, baseMs: 1000, maxAttempts: 5 })).toEqual({
      shouldRetry: true,
      delayMs: 2000,
      nextAttempt: 2,
    });
    expect(nextRetry({ attempt: 3, baseMs: 1000, maxAttempts: 5 })).toEqual({
      shouldRetry: true,
      delayMs: 8000,
      nextAttempt: 4,
    });
  });

  test("stops retrying once the attempt count reaches the cap", () => {
    expect(
      nextRetry({ attempt: 5, baseMs: 1000, maxAttempts: 5 }).shouldRetry,
    ).toBe(false);
    expect(
      nextRetry({ attempt: 6, baseMs: 1000, maxAttempts: 5 }).shouldRetry,
    ).toBe(false);
  });
});
