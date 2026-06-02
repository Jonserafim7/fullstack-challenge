// The contract between the games service (emits) and this client (consumes): the REST round
// snapshot and the server->client WebSocket event payloads. Consolidated here as the single
// source the game feature imports; the planned home is a shared @crash/contracts package once
// the event shapes stabilize.

export const RoundPhase = {
  BETTING: "BETTING",
  RUNNING: "RUNNING",
  CRASHED: "CRASHED",
  SETTLED: "SETTLED",
} as const;
export type RoundPhase = (typeof RoundPhase)[keyof typeof RoundPhase];

// The REST snapshot a client hydrates from on connect (ADR-0003). crashPoint is in integer
// hundredths (247 = 2.47x) and stays null until the Round has Crashed.
export interface RoundSnapshot {
  roundNumber: number;
  phase: RoundPhase;
  crashPoint: number | null;
  bettingEndsAt: string | null;
  startedAt: string | null;
  crashedAt: string | null;
}

// The server->client events (ADR-0003); mirrors the games gateway's RoundEvent names.
export const RoundEvent = {
  BETTING_OPENED: "round.betting_opened",
  RUNNING: "round.running",
  CRASHED: "round.crashed",
  // A Bet's stake was debited and it is now Confirmed. Public; the placing client matches betId
  // against its own pending Bet (#14).
  BET_CONFIRMED: "bet.confirmed",
  // A player cashed out before the crash. Public; the placing client matches betId to reconcile its
  // own Bet and refetch the credited balance (#8).
  BET_CASHED_OUT: "bet.cashed_out",
  // A Bet was Rejected (the Wallet refused the debit). Private — delivered only to the placing
  // player, never broadcast, since a refusal reveals their funds (#7).
  BET_REJECTED: "bet.rejected",
} as const;

export interface BettingOpenedEvent {
  roundNumber: number;
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
  // Same integer-hundredths unit as RoundSnapshot.crashPoint (247 = 2.47x).
  crashPoint: number;
  crashedAt: string;
  verification: CrashVerification;
}

// The REST verification payload for a past Round (GET /games/rounds/:n/verify). Everything a
// client needs to independently confirm the Round was fair: hash serverSeed to check it links to
// previousSeed, then recompute the Crash Point from the seeds + house edge (ADR-0002). previousSeed
// is null for Rounds recorded before the chain link was persisted.
export interface RoundVerification {
  roundNumber: number;
  serverSeed: string;
  previousSeed: string | null;
  clientSeed: string;
  houseEdge: number;
  crashPoint: number;
}

export interface BetConfirmedEvent {
  betId: string;
  roundNumber: number;
  username: string;
  // Stake in integer cents (ADR-0004).
  amountCents: number;
}

export interface BetCashedOutEvent {
  betId: string;
  roundNumber: number;
  username: string;
  // Locked multiplier in integer hundredths (247 = 2.47x).
  multiplierHundredths: number;
  // Payout in integer cents = stake × locked multiplier.
  payoutCents: number;
}

// Private (owner-only): the Wallet refused this player's debit. The placing client matches betId to
// reflect Rejected on its own Bet and shows the reason (#7).
export interface BetRejectedEvent {
  betId: string;
  roundNumber: number;
  playerId: string;
  reason: string;
}
