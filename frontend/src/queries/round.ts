import axios from "axios";
import { api } from "@/lib/api";

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

export async function fetchCurrentRound(): Promise<RoundSnapshot | null> {
  try {
    const { data } = await api.get<RoundSnapshot>("/games/rounds/current");
    return data;
  } catch (error) {
    // No Round has started yet — the engine is between boot and the first Round.
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}
