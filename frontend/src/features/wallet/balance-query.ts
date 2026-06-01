import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface WalletResponse {
  playerId: string;
  balance: number;
}

export const walletQueryKey = ["wallet", "me"] as const;

async function fetchWallet(): Promise<WalletResponse> {
  try {
    const { data } = await api.get<WalletResponse>("/wallets/me");
    return data;
  } catch (error) {
    // First login for a player: no wallet yet — create it, then read.
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      const { data } = await api.post<WalletResponse>("/wallets");
      return data;
    }
    throw error;
  }
}

export function useBalanceQuery() {
  return useQuery({
    queryKey: walletQueryKey,
    queryFn: fetchWallet,
  });
}
