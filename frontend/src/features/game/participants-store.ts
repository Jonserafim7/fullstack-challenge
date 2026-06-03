import { create } from "zustand";
import type { BetCashedOutEvent, BetConfirmedEvent } from "./round-contracts";

export interface Participant {
  betId: string;
  username: string;
  amountCents: number;
  status: "confirmed" | "cashed_out";
  multiplierHundredths: number | null;
  payoutCents: number | null;
}

interface ParticipantsState {
  roundNumber: number | null;
  participants: Map<string, Participant>;
  confirm: (event: BetConfirmedEvent) => void;
  cashOut: (event: BetCashedOutEvent) => void;
  clear: () => void;
}

export const useParticipantsStore = create<ParticipantsState>((set) => ({
  roundNumber: null,
  participants: new Map(),

  confirm: (event) =>
    set((state) => {
      const isNewRound = event.roundNumber !== state.roundNumber;
      // Never downgrade a cashed-out row back to confirmed — a confirmation can race a cash-out.
      if (
        !isNewRound &&
        state.participants.get(event.betId)?.status === "cashed_out"
      ) {
        return {};
      }
      const next = isNewRound ? new Map() : new Map(state.participants);
      next.set(event.betId, {
        betId: event.betId,
        username: event.username,
        amountCents: event.amountCents,
        status: "confirmed",
        multiplierHundredths: null,
        payoutCents: null,
      });
      return { roundNumber: event.roundNumber, participants: next };
    }),

  cashOut: (event) =>
    set((state) => {
      const isNewRound = event.roundNumber !== state.roundNumber;
      const next = isNewRound ? new Map() : new Map(state.participants);
      const existing = next.get(event.betId);
      // A late joiner may never have seen the confirmation; recover stake from payout ÷ multiplier.
      const reconstructedStake = Math.round(
        (event.payoutCents * 100) / event.multiplierHundredths,
      );
      next.set(event.betId, {
        betId: event.betId,
        username: event.username,
        amountCents: existing?.amountCents ?? reconstructedStake,
        status: "cashed_out",
        multiplierHundredths: event.multiplierHundredths,
        payoutCents: event.payoutCents,
      });
      return { roundNumber: event.roundNumber, participants: next };
    }),

  clear: () => set({ roundNumber: null, participants: new Map() }),
}));
