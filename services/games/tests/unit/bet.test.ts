import { describe, test, expect } from "bun:test";
import { Money } from "@crash/money";
import { Bet, BetStatus } from "../../src/domain/entities/bet";
import { InvalidBetTransitionError } from "../../src/domain/errors/invalid-bet-transition.error";

function placeBet(): Bet {
  return Bet.place({
    betId: "bet-1",
    roundNumber: 7,
    playerId: "player-1",
    username: "player",
    stake: Money.fromCents(500),
  });
}

describe("Bet", () => {
  test("is placed Pending, carrying its stake and the player's name", () => {
    const bet = placeBet();

    expect(bet.status).toBe(BetStatus.PENDING);
    expect(bet.roundNumber).toBe(7);
    expect(bet.playerId).toBe("player-1");
    expect(bet.username).toBe("player");
    expect(bet.stake.cents).toBe(500n);
    expect(bet.confirmedAt).toBeNull();
  });

  test("becomes Confirmed when the Wallet debit lands", () => {
    const bet = placeBet();
    const confirmedAt = new Date("2026-01-01T00:00:03Z");

    bet.confirm({ confirmedAt });

    expect(bet.status).toBe(BetStatus.CONFIRMED);
    expect(bet.confirmedAt).toEqual(confirmedAt);
  });

  test("rejects confirming a Bet that is not Pending", () => {
    const bet = placeBet();
    bet.confirm({ confirmedAt: new Date() });

    expect(() => bet.confirm({ confirmedAt: new Date() })).toThrow(
      InvalidBetTransitionError,
    );
  });

  test("restores a Bet from persistence at its stored status", () => {
    const confirmedAt = new Date("2026-01-01T00:00:03Z");
    const bet = Bet.restore({
      betId: "bet-2",
      roundNumber: 9,
      playerId: "player-2",
      username: "other",
      stake: Money.fromCents(1000),
      status: BetStatus.CONFIRMED,
      confirmedAt,
    });

    expect(bet.status).toBe(BetStatus.CONFIRMED);
    expect(bet.confirmedAt).toEqual(confirmedAt);
    expect(() => bet.confirm({ confirmedAt: new Date() })).toThrow(
      InvalidBetTransitionError,
    );
  });
});
