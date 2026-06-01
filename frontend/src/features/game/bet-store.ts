import { create } from "zustand";
import { BetStatus } from "./bet-api";

// The client's own latest Bet. Born Pending when POST /games/bet returns 202, flipped to Confirmed
// when the public bet.confirmed event arrives for this betId. It carries its roundNumber so the
// panel can tell whether it belongs to the current Round; it is replaced (not cleared on round
// change) when the player places the next Bet. Keeping it past the round boundary means a
// confirmation that lands just after the next Round opens still matches by betId, so the balance
// refetch is never skipped. Other players' bets are not tracked — #14 only needs the placer's own
// state (ADR-0006: Zustand for live, WebSocket-driven state).
interface ActiveBet {
  betId: string;
  roundNumber: number;
  stakeCents: number;
  status: BetStatus;
}

interface BetState {
  bet: ActiveBet | null;
  placePending: (bet: ActiveBet) => void;
  confirm: (betId: string) => void;
}

export const useBetStore = create<BetState>((set) => ({
  bet: null,

  placePending: (bet) => set({ bet }),

  confirm: (betId) =>
    set((state) =>
      state.bet?.betId === betId
        ? { bet: { ...state.bet, status: BetStatus.CONFIRMED } }
        : {},
    ),
}));
