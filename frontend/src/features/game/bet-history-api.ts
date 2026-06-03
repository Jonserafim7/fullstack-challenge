import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { type BetStatus } from "./bet-api";

export interface HistoryBet {
  betId: string;
  roundNumber: number;
  status: BetStatus;
  stakeCents: number;
  cashedOutMultiplier: number | null;
  payoutCents: number | null;
}

export interface BetHistoryPage {
  bets: HistoryBet[];
  total: number;
  page: number;
  pageSize: number;
}

export const BET_HISTORY_PAGE_SIZE = 5;

export const betHistoryQueryKey = ["bets", "me"] as const;

async function fetchBetHistory(page: number): Promise<BetHistoryPage> {
  const { data } = await api.get<BetHistoryPage>("/games/bets/me", {
    params: { page, pageSize: BET_HISTORY_PAGE_SIZE },
  });
  return data;
}

export function useBetHistoryQuery(page: number) {
  return useQuery({
    queryKey: [...betHistoryQueryKey, page],
    queryFn: () => fetchBetHistory(page),
    placeholderData: keepPreviousData,
  });
}
