import { create } from "zustand";
import { RoundPhase, type RoundSnapshot } from "@/queries/round";

// The server->client phase events (ADR-0003); mirrors the games gateway's RoundEvent names.
export const RoundEvent = {
  BETTING_OPENED: "round.betting_opened",
  RUNNING: "round.running",
  CRASHED: "round.crashed",
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

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface RoundState {
  connection: ConnectionStatus;
  roundNumber: number | null;
  phase: RoundPhase | null;
  bettingEndsAt: string | null;
  startedAt: string | null;
  crashedAt: string | null;
  crashPoint: number | null;
  seedHash: string | null;
  verification: CrashVerification | null;
  setConnection: (status: ConnectionStatus) => void;
  hydrate: (snapshot: RoundSnapshot | null) => void;
  applyBettingOpened: (event: BettingOpenedEvent) => void;
  applyRunning: (event: RunningEvent) => void;
  applyCrashed: (event: CrashedEvent) => void;
}

// Live Round state seeded by the REST snapshot on connect, then advanced by WebSocket deltas
// (ADR-0006: Zustand for WebSocket-pushed live state). The multiplier curve is not kept here —
// it is a cosmetic client-side function of time, rendered on a canvas in a later slice (#13).
export const useRoundStore = create<RoundState>((set) => ({
  connection: "connecting",
  roundNumber: null,
  phase: null,
  bettingEndsAt: null,
  startedAt: null,
  crashedAt: null,
  crashPoint: null,
  seedHash: null,
  verification: null,

  setConnection: (connection) => set({ connection }),

  hydrate: (snapshot) =>
    set(
      snapshot
        ? {
            roundNumber: snapshot.roundNumber,
            phase: snapshot.phase,
            bettingEndsAt: snapshot.bettingEndsAt,
            startedAt: snapshot.startedAt,
            crashedAt: snapshot.crashedAt,
            crashPoint: snapshot.crashPoint,
          }
        : {},
    ),

  applyBettingOpened: (event) =>
    set({
      roundNumber: event.roundNumber,
      phase: RoundPhase.BETTING,
      bettingEndsAt: event.bettingEndsAt,
      seedHash: event.seedHash,
      startedAt: null,
      crashedAt: null,
      crashPoint: null,
      verification: null,
    }),

  applyRunning: (event) =>
    set({
      roundNumber: event.roundNumber,
      phase: RoundPhase.RUNNING,
      startedAt: event.startedAt,
    }),

  applyCrashed: (event) =>
    set({
      roundNumber: event.roundNumber,
      phase: RoundPhase.CRASHED,
      crashPoint: event.crashPoint,
      crashedAt: event.crashedAt,
      verification: event.verification,
    }),
}));
