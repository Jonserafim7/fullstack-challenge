import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { type RoundSnapshot, type RoundVerification } from "./round-contracts";

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

async function fetchRoundVerification(
  roundNumber: number,
): Promise<RoundVerification> {
  const { data } = await api.get<RoundVerification>(
    `/games/rounds/${roundNumber}/verify`,
  );
  return data;
}

// The provably-fair data for one past Round. Only enabled once a Round is selected; the result is
// immutable (a terminal Round never changes), so it never needs refetching.
export function useRoundVerificationQuery(roundNumber: number | null) {
  return useQuery({
    queryKey: ["rounds", "verify", roundNumber],
    queryFn: () => fetchRoundVerification(roundNumber!),
    enabled: roundNumber !== null,
    staleTime: Infinity,
  });
}
