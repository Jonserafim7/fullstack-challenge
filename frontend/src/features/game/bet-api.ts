import { api } from "@/lib/api";

// Mirrors the games Bet lifecycle (CONTEXT.md). #14 only surfaces Pending and Confirmed; the rest
// arrive with cash out (#8) and compensation (#7).
export const BetStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  REJECTED: "REJECTED",
  CASHED_OUT: "CASHED_OUT",
  LOST: "LOST",
  VOIDED: "VOIDED",
} as const;
export type BetStatus = (typeof BetStatus)[keyof typeof BetStatus];

// The 202 response from POST /games/bet: a Pending Bet whose stake is being debited asynchronously.
export interface PlaceBetResponse {
  betId: string;
  roundNumber: number;
  status: BetStatus;
  stakeCents: number;
}

export async function placeBet(stakeCents: number): Promise<PlaceBetResponse> {
  const { data } = await api.post<PlaceBetResponse>("/games/bet", {
    stakeCents,
  });
  return data;
}
