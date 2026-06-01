import { Money } from "@crash/money";
import { InvalidBetTransitionError } from "../errors/invalid-bet-transition.error";

// The full Bet lifecycle from CONTEXT.md. Modeled in one place as the domain's shared language;
// #14 only exercises Pending -> Confirmed. The terminal states (Rejected on a refused debit,
// Voided on a missed betting window, Cashed Out / Lost at settlement) get their transitions with
// #7 (compensation) and #8 (cash out).
export const BetStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  REJECTED: "REJECTED",
  CASHED_OUT: "CASHED_OUT",
  LOST: "LOST",
  VOIDED: "VOIDED",
} as const;
export type BetStatus = (typeof BetStatus)[keyof typeof BetStatus];

// A single player's wager on one Round (CONTEXT.md). The aggregate owns only the bet rules — its
// status machine — not persistence or the broker. It is born Pending and becomes a real
// participant in the Round only once the Wallet confirms the debit. The username is captured at
// placement so the public `bet.confirmed` broadcast can name the player without wallets ever
// learning usernames (it deals in playerId and money alone).
export class Bet {
  private constructor(
    public readonly betId: string,
    public readonly roundNumber: number,
    public readonly playerId: string,
    public readonly username: string,
    public readonly stake: Money,
    private currentStatus: BetStatus,
    private confirmedTimestamp: Date | null,
    private cashedOutMultiplierHundredths: number | null,
    private cashedOutTimestamp: Date | null,
  ) {}

  static place({
    betId,
    roundNumber,
    playerId,
    username,
    stake,
  }: {
    betId: string;
    roundNumber: number;
    playerId: string;
    username: string;
    stake: Money;
  }): Bet {
    return new Bet(
      betId,
      roundNumber,
      playerId,
      username,
      stake,
      BetStatus.PENDING,
      null,
      null,
      null,
    );
  }

  static restore({
    betId,
    roundNumber,
    playerId,
    username,
    stake,
    status,
    confirmedAt,
    cashedOutMultiplier,
    cashedOutAt,
  }: {
    betId: string;
    roundNumber: number;
    playerId: string;
    username: string;
    stake: Money;
    status: BetStatus;
    confirmedAt: Date | null;
    cashedOutMultiplier: number | null;
    cashedOutAt: Date | null;
  }): Bet {
    return new Bet(
      betId,
      roundNumber,
      playerId,
      username,
      stake,
      status,
      confirmedAt,
      cashedOutMultiplier,
      cashedOutAt,
    );
  }

  get status(): BetStatus {
    return this.currentStatus;
  }

  get confirmedAt(): Date | null {
    return this.confirmedTimestamp;
  }

  // The locked multiplier (integer hundredths, 247 = 2.47x) at the instant the player cashed out,
  // null until then. The payout is stake × this value.
  get cashedOutMultiplier(): number | null {
    return this.cashedOutMultiplierHundredths;
  }

  get cashedOutAt(): Date | null {
    return this.cashedOutTimestamp;
  }

  // The Wallet debited the stake: the bet is now a real participant in the Round. Idempotency
  // lives in the inbox (a redelivered confirmation never reaches here twice), so a second confirm
  // is a genuine programming error and throws.
  confirm({ confirmedAt }: { confirmedAt: Date }): void {
    this.ensureCurrentStatusIs(BetStatus.PENDING, BetStatus.CONFIRMED);
    this.currentStatus = BetStatus.CONFIRMED;
    this.confirmedTimestamp = confirmedAt;
  }

  // The player cashed out while the Round was Running: lock in the multiplier games computed from
  // the shared curve (the server is the authority — never the client) and record the moment. Only a
  // Confirmed bet can cash out; the payout credit follows asynchronously and unconditionally (#8).
  cashOut({
    multiplierHundredths,
    at,
  }: {
    multiplierHundredths: number;
    at: Date;
  }): void {
    this.ensureCurrentStatusIs(BetStatus.CONFIRMED, BetStatus.CASHED_OUT);
    this.currentStatus = BetStatus.CASHED_OUT;
    this.cashedOutMultiplierHundredths = multiplierHundredths;
    this.cashedOutTimestamp = at;
  }

  // The Round crashed and this Confirmed bet never cashed out. No money moves — the stake left at
  // debit-on-bet (ADR-0001); Lost only records that the wager did not win.
  lose(): void {
    this.ensureCurrentStatusIs(BetStatus.CONFIRMED, BetStatus.LOST);
    this.currentStatus = BetStatus.LOST;
  }

  private ensureCurrentStatusIs(
    expected: BetStatus,
    attempted: BetStatus,
  ): void {
    if (this.currentStatus !== expected) {
      throw new InvalidBetTransitionError({
        from: this.currentStatus,
        to: attempted,
      });
    }
  }
}
