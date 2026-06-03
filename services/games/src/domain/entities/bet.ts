import { Money } from "@crash/money";
import { InvalidBetTransitionError } from "../errors/invalid-bet-transition.error";

export const BetStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  REJECTED: "REJECTED",
  CASHED_OUT: "CASHED_OUT",
  LOST: "LOST",
  VOIDED: "VOIDED",
} as const;
export type BetStatus = (typeof BetStatus)[keyof typeof BetStatus];

// The username is captured at placement so the public bet.confirmed broadcast can name the player
// without wallets ever learning usernames — it deals in playerId and money alone.
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

  // Integer hundredths (247 = 2.47x), null until cashed out.
  get cashedOutMultiplier(): number | null {
    return this.cashedOutMultiplierHundredths;
  }

  get cashedOutAt(): Date | null {
    return this.cashedOutTimestamp;
  }

  // Idempotency lives in the inbox, so a redelivered confirmation never reaches here twice; a second
  // confirm is therefore a programming error and throws.
  confirm({ confirmedAt }: { confirmedAt: Date }): void {
    this.ensureCurrentStatusIs(BetStatus.PENDING, BetStatus.CONFIRMED);
    this.currentStatus = BetStatus.CONFIRMED;
    this.confirmedTimestamp = confirmedAt;
  }

  // The multiplier is the server's authority from the shared curve, never the client's.
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

  // No money moves: the stake already left at debit-on-bet (ADR-0001), so Lost only records the miss.
  lose(): void {
    this.ensureCurrentStatusIs(BetStatus.CONFIRMED, BetStatus.LOST);
    this.currentStatus = BetStatus.LOST;
  }

  // A rejection for an already-Voided bet is a no-op resolved upstream and never reaches here.
  reject(): void {
    this.ensureCurrentStatusIs(BetStatus.PENDING, BetStatus.REJECTED);
    this.currentStatus = BetStatus.REJECTED;
  }

  // No money moves here; if the debit lands afterward, the late confirmation issues a Refund (ADR-0001).
  void(): void {
    this.ensureCurrentStatusIs(BetStatus.PENDING, BetStatus.VOIDED);
    this.currentStatus = BetStatus.VOIDED;
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
