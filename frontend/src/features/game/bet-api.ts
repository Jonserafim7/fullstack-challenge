import { api } from "@/lib/api";
import { BetStatus } from "./round-contracts";

// BetStatus lives in the pure contracts module; re-exported here so existing importers are unchanged.
export { BetStatus };

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

// The 200 response from POST /games/bet/cashout: the Bet is now Cashed Out with its locked
// multiplier (integer hundredths, 247 = 2.47x) and payout in cents. The credit lands asynchronously.
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
