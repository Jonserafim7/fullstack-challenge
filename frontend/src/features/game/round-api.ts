import axios from "axios";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
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

export interface RoundHistoryPage {
  rounds: RoundSnapshot[];
  total: number;
  page: number;
  pageSize: number;
}

export const roundHistoryQueryKey = ["rounds", "history"] as const;

export const ROUND_HISTORY_PAGE_SIZE = 20;

async function fetchRoundHistory(page: number): Promise<RoundHistoryPage> {
  const { data } = await api.get<RoundHistoryPage>("/games/rounds/history", {
    params: { page, pageSize: ROUND_HISTORY_PAGE_SIZE },
  });
  return data;
}

// A page of terminal Rounds for the history strip. Page 1 is the most recent ~20, refetched on each
// round.crashed (the socket hook invalidates the ["rounds","history"] prefix, which matches every
// page key) so the live page stays current without polling; older pages are browsable via the UI.
// keepPreviousData avoids the strip flashing empty while the next page loads.
export function useRoundHistoryQuery(page: number) {
  return useQuery({
    queryKey: [...roundHistoryQueryKey, page],
    queryFn: () => fetchRoundHistory(page),
    placeholderData: keepPreviousData,
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
