// The contract between the games service (emits) and this client (consumes): the REST snapshot and
// the server->client WebSocket payloads. The planned home is a shared @crash/contracts package.

export const RoundPhase = {
  BETTING: "BETTING",
  RUNNING: "RUNNING",
  CRASHED: "CRASHED",
  SETTLED: "SETTLED",
} as const;
export type RoundPhase = (typeof RoundPhase)[keyof typeof RoundPhase];

// In this pure contracts module (not bet-api) so the feature's logic and tests can use it without
// pulling the API/auth layer.
export const BetStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  REJECTED: "REJECTED",
  CASHED_OUT: "CASHED_OUT",
  LOST: "LOST",
  VOIDED: "VOIDED",
} as const;
export type BetStatus = (typeof BetStatus)[keyof typeof BetStatus];

// crashPoint is integer hundredths (247 = 2.47x), null until the Round has Crashed.
export interface RoundSnapshot {
  roundNumber: number;
  phase: RoundPhase;
  crashPoint: number | null;
  bettingEndsAt: string | null;
  startedAt: string | null;
  crashedAt: string | null;
}

// Server->client events (ADR-0003); mirrors the games gateway's RoundEvent names.
export const RoundEvent = {
  BETTING_OPENED: "round.betting_opened",
  RUNNING: "round.running",
  CRASHED: "round.crashed",
  BET_CONFIRMED: "bet.confirmed",
  BET_CASHED_OUT: "bet.cashed_out",
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
  crashPoint: number;
  crashedAt: string;
  verification: CrashVerification;
}

// Everything needed to independently verify a past Round: hash serverSeed to check it links to
// previousSeed, then recompute the Crash Point from the seeds + house edge (ADR-0002).
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
  amountCents: number;
}

export interface BetCashedOutEvent {
  betId: string;
  roundNumber: number;
  username: string;
  multiplierHundredths: number;
  payoutCents: number;
}

export interface BetRejectedEvent {
  betId: string;
  roundNumber: number;
  playerId: string;
  reason: string;
}
