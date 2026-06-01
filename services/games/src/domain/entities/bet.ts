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
  }: {
    betId: string;
    roundNumber: number;
    playerId: string;
    username: string;
    stake: Money;
    status: BetStatus;
    confirmedAt: Date | null;
  }): Bet {
    return new Bet(
      betId,
      roundNumber,
      playerId,
      username,
      stake,
      status,
      confirmedAt,
    );
  }

  get status(): BetStatus {
    return this.currentStatus;
  }

  get confirmedAt(): Date | null {
    return this.confirmedTimestamp;
  }

  // The Wallet debited the stake: the bet is now a real participant in the Round. Idempotency
  // lives in the inbox (a redelivered confirmation never reaches here twice), so a second confirm
  // is a genuine programming error and throws.
  confirm({ confirmedAt }: { confirmedAt: Date }): void {
    this.ensureCurrentStatusIs(BetStatus.PENDING, BetStatus.CONFIRMED);
    this.currentStatus = BetStatus.CONFIRMED;
    this.confirmedTimestamp = confirmedAt;
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
