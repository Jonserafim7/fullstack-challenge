import { create } from "zustand";
import type { BetCashedOutEvent, BetConfirmedEvent } from "./round-contracts";

// Everyone in the current Round, from the public bet.confirmed / bet.cashed_out broadcasts. Keyed
// by betId so a cash-out updates the same row its confirmation created. The list only ever shows the
// Round in progress: BETTING_OPENED clears it, and every event carries its roundNumber so the first
// event of a new round also resets it — covering a reconnect that missed BETTING_OPENED.
export interface Participant {
  betId: string;
  username: string;
  amountCents: number;
  status: "confirmed" | "cashed_out";
  // Set once the participant cashes out: the locked multiplier (integer hundredths) and payout.
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
      // A confirmation can arrive after a (racing) cash-out for the same betId; never downgrade a
      // cashed-out row back to confirmed (unless this event opens a new round).
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
      // A late joiner may never have seen this bet's confirmation; the cash-out event omits the
      // stake, but payout = stake × multiplier, so recover it from payout ÷ multiplier.
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
