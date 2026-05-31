import { describe, test, expect } from "bun:test";
import { Money } from "@crash/money";
import { Wallet } from "../../src/domain/entities/wallet";
import { InsufficientBalanceError } from "../../src/domain/errors/insufficient-balance.error";

describe("Wallet", () => {
  test("is created for a player with an initial balance", () => {
    const wallet = Wallet.create({
      playerId: "player-1",
      initialBalance: Money.fromCents(10000),
    });

    expect(wallet.playerId).toBe("player-1");
    expect(wallet.balance.cents).toBe(10000n);
  });

  test("credit increases the balance", () => {
    const wallet = Wallet.create({
      playerId: "player-1",
      initialBalance: Money.fromCents(10000),
    });

    wallet.credit(Money.fromCents(2500));

    expect(wallet.balance.cents).toBe(12500n);
  });

  test("debit decreases the balance", () => {
    const wallet = Wallet.create({
      playerId: "player-1",
      initialBalance: Money.fromCents(10000),
    });

    wallet.debit(Money.fromCents(3000));

    expect(wallet.balance.cents).toBe(7000n);
  });

  test("debit of the entire balance leaves it at zero", () => {
    const wallet = Wallet.create({
      playerId: "player-1",
      initialBalance: Money.fromCents(5000),
    });

    wallet.debit(Money.fromCents(5000));

    expect(wallet.balance.cents).toBe(0n);
  });

  test("rejects a debit larger than the balance, leaving it unchanged", () => {
    const wallet = Wallet.create({
      playerId: "player-1",
      initialBalance: Money.fromCents(5000),
    });

    expect(() => wallet.debit(Money.fromCents(5001))).toThrow(
      InsufficientBalanceError,
    );
    expect(wallet.balance.cents).toBe(5000n);
  });
});
