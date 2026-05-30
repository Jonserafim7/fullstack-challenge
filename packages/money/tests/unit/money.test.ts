import { describe, test, expect } from "bun:test";
import { Money } from "../../src/money";

describe("Money", () => {
  test("is created from integer cents and exposes them", () => {
    const amount = Money.fromCents(1000);

    expect(amount.cents).toBe(1000);
  });

  test("rejects a negative amount", () => {
    expect(() => Money.fromCents(-1)).toThrow();
  });

  test("rejects a fractional amount", () => {
    expect(() => Money.fromCents(10.5)).toThrow();
  });

  test("adds another amount without mutating either operand", () => {
    const balance = Money.fromCents(1000);
    const credit = Money.fromCents(250);

    const total = balance.plus(credit);

    expect(total.cents).toBe(1250);
    expect(balance.cents).toBe(1000);
    expect(credit.cents).toBe(250);
  });

  test("subtracts another amount", () => {
    const balance = Money.fromCents(1000);

    const remaining = balance.minus(Money.fromCents(250));

    expect(remaining.cents).toBe(750);
  });

  test("throws when subtraction would go negative", () => {
    const balance = Money.fromCents(100);

    expect(() => balance.minus(Money.fromCents(101))).toThrow();
  });

  test("multiplies by a multiplier in hundredths", () => {
    const stake = Money.fromCents(500);

    const payout = stake.times(247);

    expect(payout.cents).toBe(1235);
  });

  test("floors sub-cent remainders on multiplication", () => {
    const stake = Money.fromCents(333);

    const payout = stake.times(150);

    expect(payout.cents).toBe(499);
  });

  test("compares amounts with isLessThan", () => {
    const balance = Money.fromCents(100);

    expect(balance.isLessThan(Money.fromCents(101))).toBe(true);
    expect(balance.isLessThan(Money.fromCents(100))).toBe(false);
    expect(balance.isLessThan(Money.fromCents(99))).toBe(false);
  });

  test("exposes a zero amount", () => {
    expect(Money.zero().cents).toBe(0);
  });
});
