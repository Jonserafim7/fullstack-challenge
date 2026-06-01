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

  function confirmedBet(): Bet {
    const bet = placeBet();
    bet.confirm({ confirmedAt: new Date("2026-01-01T00:00:03Z") });
    return bet;
  }

  test("cashes out a Confirmed Bet, locking the multiplier and the moment", () => {
    const bet = confirmedBet();
    const at = new Date("2026-01-01T00:00:08Z");

    bet.cashOut({ multiplierHundredths: 247, at });

    expect(bet.status).toBe(BetStatus.CASHED_OUT);
    expect(bet.cashedOutMultiplier).toBe(247);
    expect(bet.cashedOutAt).toEqual(at);
  });

  test("rejects cashing out a Bet that is not Confirmed", () => {
    const pending = placeBet();

    expect(() =>
      pending.cashOut({ multiplierHundredths: 200, at: new Date() }),
    ).toThrow(InvalidBetTransitionError);
  });

  test("marks a Confirmed Bet Lost when the Round crashes", () => {
    const bet = confirmedBet();

    bet.lose();

    expect(bet.status).toBe(BetStatus.LOST);
    expect(bet.cashedOutMultiplier).toBeNull();
  });

  test("rejects losing a Bet that already cashed out", () => {
    const bet = confirmedBet();
    bet.cashOut({ multiplierHundredths: 300, at: new Date() });

    expect(() => bet.lose()).toThrow(InvalidBetTransitionError);
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
      cashedOutMultiplier: null,
      cashedOutAt: null,
    });

    expect(bet.status).toBe(BetStatus.CONFIRMED);
    expect(bet.confirmedAt).toEqual(confirmedAt);
    expect(() => bet.confirm({ confirmedAt: new Date() })).toThrow(
      InvalidBetTransitionError,
    );
  });

  test("restores a cashed-out Bet with its locked multiplier", () => {
    const cashedOutAt = new Date("2026-01-01T00:00:08Z");
    const bet = Bet.restore({
      betId: "bet-3",
      roundNumber: 9,
      playerId: "player-3",
      username: "winner",
      stake: Money.fromCents(1000),
      status: BetStatus.CASHED_OUT,
      confirmedAt: new Date("2026-01-01T00:00:03Z"),
      cashedOutMultiplier: 250,
      cashedOutAt,
    });

    expect(bet.status).toBe(BetStatus.CASHED_OUT);
    expect(bet.cashedOutMultiplier).toBe(250);
    expect(bet.cashedOutAt).toEqual(cashedOutAt);
  });
});
