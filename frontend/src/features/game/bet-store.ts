import { create } from "zustand";
import { BetStatus } from "./bet-api";

// The client's own Bet on the current Round. Born Pending when POST /games/bet returns 202, flipped
// to Confirmed when the public bet.confirmed event arrives for this betId. Cleared when a new Round
// opens so the player can bet again. Other players' bets are not tracked here — #14 only needs the
// placer's own state (ADR-0006: Zustand for live, WebSocket-driven state).
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
  resetForRound: (roundNumber: number) => void;
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

  resetForRound: (roundNumber) =>
    set((state) =>
      state.bet && state.bet.roundNumber !== roundNumber ? { bet: null } : {},
    ),
}));
