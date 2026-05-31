// The names of the server->client phase events (ADR-0003). Kept as a shared const so the
// gateway and tests agree on the wire format; the frontend mirrors these strings.
export const RoundEvent = {
  BETTING_OPENED: "round.betting_opened",
  RUNNING: "round.running",
  CRASHED: "round.crashed",
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

// The port the Round engine depends on to push phase transitions, keeping it decoupled from
// the WebSocket transport (mirrors the RoundRepository port). The gateway implements it.
export abstract class RoundEventPublisher {
  abstract bettingOpened(event: BettingOpenedEvent): void;
  abstract running(event: RunningEvent): void;
  abstract crashed(event: CrashedEvent): void;
}
