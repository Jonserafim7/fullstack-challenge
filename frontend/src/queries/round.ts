import axios from "axios";
import { useQuery } from "@tanstack/react-query";
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

interface RoundHistoryResponse {
  rounds: RoundSnapshot[];
  total: number;
  page: number;
  pageSize: number;
}

export const roundHistoryQueryKey = ["rounds", "history"] as const;

const HISTORY_PAGE_SIZE = 20;

async function fetchRoundHistory(): Promise<RoundSnapshot[]> {
  const { data } = await api.get<RoundHistoryResponse>(
    "/games/rounds/history",
    {
      params: { page: 1, pageSize: HISTORY_PAGE_SIZE },
    },
  );
  return data.rounds;
}

// The last ~20 terminal Rounds for the history strip; refetched on each round.crashed
// (the socket hook invalidates this key) so the strip stays current without polling.
export function useRoundHistoryQuery() {
  return useQuery({
    queryKey: roundHistoryQueryKey,
    queryFn: fetchRoundHistory,
  });
}
