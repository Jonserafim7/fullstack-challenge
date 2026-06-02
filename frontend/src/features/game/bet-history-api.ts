import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { type BetStatus } from "./bet-api";

// One row of the player's own Bet history (GET /games/bets/me). Mirrors the games BetResponseDto.
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

export const BET_HISTORY_PAGE_SIZE = 10;

// The page-less prefix of the per-page query keys built in useBetHistoryQuery ([...key, page]).
// Invalidating this prefix matches every cached page at once, so the socket can refresh the whole
// history when the player's own Bet changes (see use-round-socket).
export const betHistoryQueryKey = ["bets", "me"] as const;

async function fetchBetHistory(page: number): Promise<BetHistoryPage> {
  const { data } = await api.get<BetHistoryPage>("/games/bets/me", {
    params: { page, pageSize: BET_HISTORY_PAGE_SIZE },
  });
  return data;
}

// The player's own Bet history, paginated. Refetched (via key invalidation in use-round-socket)
// whenever one of the player's Bets reaches a new state, so the list stays current without polling.
export function useBetHistoryQuery(page: number) {
  return useQuery({
    queryKey: [...betHistoryQueryKey, page],
    queryFn: () => fetchBetHistory(page),
    placeholderData: keepPreviousData,
  });
}
