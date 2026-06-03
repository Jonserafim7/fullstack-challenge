import { create } from "zustand";
import { BetStatus } from "./round-contracts";

export interface ActiveBet {
  betId: string;
  roundNumber: number;
  stakeCents: number;
  status: BetStatus;
  cashedOutMultiplier: number | null;
  payoutCents: number | null;
}

interface BetState {
  bet: ActiveBet | null;
  placePending: (
    bet: Omit<ActiveBet, "cashedOutMultiplier" | "payoutCents">,
  ) => void;
  confirm: (betId: string) => void;
  reject: (betId: string) => void;
  cashOut: (args: {
    betId: string;
    cashedOutMultiplier: number;
    payoutCents: number;
  }) => void;
}

export const useBetStore = create<BetState>((set) => ({
  bet: null,

  placePending: (bet) =>
    set({ bet: { ...bet, cashedOutMultiplier: null, payoutCents: null } }),

  confirm: (betId) =>
    set((state) =>
      state.bet?.betId === betId
        ? { bet: { ...state.bet, status: BetStatus.CONFIRMED } }
        : {},
    ),

  // No money moved on rejection; only flips a matching bet so a stale rejection cannot clobber a newer one.
  reject: (betId) =>
    set((state) =>
      state.bet?.betId === betId
        ? { bet: { ...state.bet, status: BetStatus.REJECTED } }
        : {},
    ),

  // Idempotent: the HTTP response and the public bet.cashed_out event both land here; the second is a no-op.
  cashOut: ({ betId, cashedOutMultiplier, payoutCents }) =>
    set((state) =>
      state.bet?.betId === betId && state.bet.status === BetStatus.CONFIRMED
        ? {
            bet: {
              ...state.bet,
              status: BetStatus.CASHED_OUT,
              cashedOutMultiplier,
              payoutCents,
            },
          }
        : {},
    ),
}));
