import { create } from "zustand";
import { BetStatus } from "./round-contracts";

// The client's own latest Bet. It carries its roundNumber so the panel knows whether it belongs to
// the current Round, and is kept past the round boundary (not cleared) so a confirmation that lands
// just after the next Round opens still matches by betId, and the balance refetch is never skipped.
export interface ActiveBet {
  betId: string;
  roundNumber: number;
  stakeCents: number;
  status: BetStatus;
  // Set once the bet cashes out: the locked multiplier (integer hundredths) and the payout cents.
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

  // The Wallet refused the debit: no money moved, the bet never participates. Only flips a still
  // tracked, matching bet so a stale rejection cannot clobber a newer one.
  reject: (betId) =>
    set((state) =>
      state.bet?.betId === betId
        ? { bet: { ...state.bet, status: BetStatus.REJECTED } }
        : {},
    ),

  // Idempotent: the HTTP response and the public bet.cashed_out event both land here; whichever is
  // first wins and the second is a no-op (the bet is no longer Confirmed).
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
