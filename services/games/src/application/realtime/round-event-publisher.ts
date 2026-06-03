// Server->client event names (ADR-0003); the frontend mirrors these strings. bet.rejected is the
// one private channel — a refused debit reveals the player's funds, so it must never broadcast.
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
  // The previous Round's revealed seed (genesis Commitment for Round 1); already the commitment to
  // this Round's seed, so no extra per-round commitment is published.
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

// playerId addresses the owner's room for private delivery; betId lets the placer reconcile its bet.
export interface BetRejectedEvent {
  betId: string;
  roundNumber: number;
  playerId: string;
  reason: string;
}

// The port the use-cases push through, decoupling them from the WebSocket transport. The gateway
// implements it.
export abstract class RoundEventPublisher {
  abstract bettingOpened(event: BettingOpenedEvent): void;
  abstract running(event: RunningEvent): void;
  abstract crashed(event: CrashedEvent): void;
  abstract betConfirmed(event: BetConfirmedEvent): void;
  abstract betCashedOut(event: BetCashedOutEvent): void;
  abstract betRejected(event: BetRejectedEvent): void;
}
