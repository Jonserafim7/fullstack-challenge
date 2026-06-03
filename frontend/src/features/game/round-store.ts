import { create } from "zustand";
import {
  RoundPhase,
  type RoundSnapshot,
  type BettingOpenedEvent,
  type RunningEvent,
  type CrashedEvent,
  type CrashVerification,
} from "./round-contracts";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

const phaseRank: Record<RoundPhase, number> = {
  [RoundPhase.BETTING]: 0,
  [RoundPhase.RUNNING]: 1,
  [RoundPhase.CRASHED]: 2,
  [RoundPhase.SETTLED]: 3,
};

// Monotonic key so a stale REST snapshot that resolves after a newer WebSocket delta is detected and ignored.
function progressKey(
  roundNumber: number | null,
  phase: RoundPhase | null,
): number {
  if (roundNumber === null || phase === null) {
    return -1;
  }
  return roundNumber * 4 + phaseRank[phase];
}

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
    set((state) => {
      if (!snapshot) {
        return {};
      }
      const isStale =
        progressKey(snapshot.roundNumber, snapshot.phase) <
        progressKey(state.roundNumber, state.phase);
      if (isStale) {
        return {};
      }
      // Clear seedHash/verification on a new round so a late joiner never shows the prior round's values.
      const isNewRound = snapshot.roundNumber !== state.roundNumber;
      return {
        roundNumber: snapshot.roundNumber,
        phase: snapshot.phase,
        bettingEndsAt: snapshot.bettingEndsAt,
        startedAt: snapshot.startedAt,
        crashedAt: snapshot.crashedAt,
        crashPoint: snapshot.crashPoint,
        ...(isNewRound ? { seedHash: null, verification: null } : {}),
      };
    }),

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
