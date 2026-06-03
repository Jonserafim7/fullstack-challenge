import { api } from "@/lib/api";
import { BetStatus } from "./round-contracts";

export { BetStatus };

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

export interface CashOutResponse {
  betId: string;
  roundNumber: number;
  status: BetStatus;
  stakeCents: number;
  cashedOutMultiplier: number | null;
  payoutCents: number | null;
}

export async function cashOutBet(): Promise<CashOutResponse> {
  const { data } = await api.post<CashOutResponse>("/games/bet/cashout");
  return data;
}
