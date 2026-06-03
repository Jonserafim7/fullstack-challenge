import { describe, expect, test } from "bun:test";
import {
  MAX_STAKE_CENTS,
  MIN_STAKE_CENTS,
  isStakeWithinBounds,
  reaisToCents,
} from "./stake";

describe("reaisToCents", () => {
  test("parses pt-BR currency text into integer cents", () => {
    expect(reaisToCents("10,00")).toBe(1000);
    expect(reaisToCents("1.000,00")).toBe(100_000);
    expect(reaisToCents("5")).toBe(500);
    expect(reaisToCents("0,99")).toBe(99);
  });

  test("returns null for empty or non-numeric input", () => {
    expect(reaisToCents("")).toBeNull();
    expect(reaisToCents("   ")).toBeNull();
    expect(reaisToCents("abc")).toBeNull();
  });
});

describe("isStakeWithinBounds", () => {
  test("accepts stakes within R$1,00–R$1.000,00", () => {
    expect(isStakeWithinBounds(MIN_STAKE_CENTS)).toBe(true);
    expect(isStakeWithinBounds(MAX_STAKE_CENTS)).toBe(true);
    expect(isStakeWithinBounds(5_000)).toBe(true);
  });

  test("rejects null, below the minimum, and above the maximum", () => {
    expect(isStakeWithinBounds(null)).toBe(false);
    expect(isStakeWithinBounds(MIN_STAKE_CENTS - 1)).toBe(false);
    expect(isStakeWithinBounds(MAX_STAKE_CENTS + 1)).toBe(false);
  });
});
