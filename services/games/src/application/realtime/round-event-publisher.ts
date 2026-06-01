// The names of the server->client events (ADR-0003). Kept as a shared const so the gateway and
// tests agree on the wire format; the frontend mirrors these strings.
export const RoundEvent = {
  BETTING_OPENED: "round.betting_opened",
  RUNNING: "round.running",
  CRASHED: "round.crashed",
  // A Bet's stake was debited: it is now Confirmed. Public, so every client sees who is in the
  // Round; the placing client matches betId against its own pending Bet (#14).
  BET_CONFIRMED: "bet.confirmed",
  // A player cashed out: the Bet locked its multiplier and won (#8). Public, so every client sees
  // who escaped before the crash; the placing client matches betId to reconcile its own Bet.
  BET_CASHED_OUT: "bet.cashed_out",
  // A Bet was Rejected (the Wallet refused the debit). Private, delivered only to the owning player
  // — a refused debit reveals the player's funds, so it must not broadcast (#7, ADR-0003).
  BET_REJECTED: "bet.rejected",
} as const;

export interface BettingOpenedEvent {
  roundNumber: number;
  // The previous Round's revealed Server Seed (or the genesis Commitment for Round 1); it is
  // already the commitment to this Round's seed, so no extra per-round commitment is published.
  seedHash: string;
  bettingEndsAt: string;
}

export interface RunningEvent {
  roundNumber: number;
  startedAt: string;
}

export interface CrashVerification {
  serverSeed: string;
  previousSeed: string;
  clientSeed: string;
  houseEdge: number;
}

export interface CrashedEvent {
  roundNumber: number;
  // Crash Point in integer hundredths (247 = 2.47x), matching the REST snapshot.
  crashPoint: number;
  crashedAt: string;
  verification: CrashVerification;
}

// Broadcast when a Bet becomes Confirmed (its stake left the Wallet). Public, with the username
// and stake, so clients can show who joined the Round; the placer reconciles its own bet by betId.
export interface BetConfirmedEvent {
  betId: string;
  roundNumber: number;
  username: string;
  amountCents: number;
}

// Broadcast when a Bet cashes out. Public, with the username, locked multiplier (integer
// hundredths, 247 = 2.47x) and payout cents, so clients can show winners as they escape; the placer
// reconciles its own bet by betId. The payout credit itself is asynchronous (ADR-0001).
export interface BetCashedOutEvent {
  betId: string;
  roundNumber: number;
  username: string;
  multiplierHundredths: number;
  payoutCents: number;
}

// Delivered only to the owning player (#7). Carries the playerId so the gateway can address that
// player's room, and the reason so the client can explain the refusal; betId lets the placer
// reconcile its own pending Bet. Never broadcast — it would leak the player's funds to everyone.
export interface BetRejectedEvent {
  betId: string;
  roundNumber: number;
  playerId: string;
  reason: string;
}

// The port the use-cases depend on to push server->client events, keeping them decoupled from the
// WebSocket transport (mirrors the RoundRepository port). The gateway implements it.
export abstract class RoundEventPublisher {
  abstract bettingOpened(event: BettingOpenedEvent): void;
  abstract running(event: RunningEvent): void;
  abstract crashed(event: CrashedEvent): void;
  abstract betConfirmed(event: BetConfirmedEvent): void;
  abstract betCashedOut(event: BetCashedOutEvent): void;
  abstract betRejected(event: BetRejectedEvent): void;
}
