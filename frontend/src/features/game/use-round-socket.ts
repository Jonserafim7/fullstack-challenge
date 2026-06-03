import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { auth } from "@/lib/auth/auth";
import { queryClient } from "@/lib/query-client";
import { walletQueryKey } from "@/features/wallet";
import { useBetStore } from "./bet-store";
import { BetStatus } from "./bet-api";
import {
  notifyBetConfirmed,
  notifyBetRejected,
  notifyCrashedLost,
} from "./game-toasts";
import { useParticipantsStore } from "./participants-store";
import { betHistoryQueryKey } from "./bet-history-api";
import { fetchCurrentRound, roundHistoryQueryKey } from "./round-api";
import { useRoundStore } from "./round-store";
import {
  RoundEvent,
  type BetCashedOutEvent,
  type BetConfirmedEvent,
  type BetRejectedEvent,
  type BettingOpenedEvent,
  type CrashedEvent,
  type RunningEvent,
} from "./round-contracts";

export function useRoundSocket(): void {
  useEffect(() => {
    let active = true;
    const {
      hydrate,
      setConnection,
      applyBettingOpened,
      applyRunning,
      applyCrashed,
    } = useRoundStore.getState();

    async function hydrateFromSnapshot(): Promise<void> {
      try {
        const snapshot = await fetchCurrentRound();
        if (active) hydrate(snapshot);
      } catch {
        // Best-effort; WebSocket deltas will populate state if the REST snapshot fails.
      }
    }

    void hydrateFromSnapshot();

    const socket: Socket = io(import.meta.env.VITE_API_BASE_URL, {
      path: "/games/socket.io",
      transports: ["websocket"],
      auth: (cb) => cb({ token: auth.getAccessToken() ?? "" }),
    });

    socket.on("connect", () => {
      setConnection("connected");
      void hydrateFromSnapshot();
    });
    socket.on("disconnect", () => setConnection("disconnected"));

    socket.on(RoundEvent.BETTING_OPENED, (event: BettingOpenedEvent) => {
      applyBettingOpened(event);
      useParticipantsStore.getState().clear();
    });
    socket.on(RoundEvent.RUNNING, (event: RunningEvent) => applyRunning(event));
    socket.on(RoundEvent.CRASHED, (event: CrashedEvent) => {
      applyCrashed(event);
      void queryClient.invalidateQueries({ queryKey: roundHistoryQueryKey });
      void queryClient.invalidateQueries({ queryKey: betHistoryQueryKey });
      const ownBet = useBetStore.getState().bet;
      if (
        ownBet?.roundNumber === event.roundNumber &&
        ownBet.status === BetStatus.CONFIRMED
      ) {
        notifyCrashedLost({ crashPointHundredths: event.crashPoint });
      }
    });
    socket.on(RoundEvent.BET_CONFIRMED, (event: BetConfirmedEvent) => {
      useParticipantsStore.getState().confirm(event);
      const { bet, confirm } = useBetStore.getState();
      if (bet?.betId === event.betId) {
        confirm(event.betId);
        notifyBetConfirmed({ stakeCents: event.amountCents });
        void queryClient.invalidateQueries({ queryKey: walletQueryKey });
        void queryClient.invalidateQueries({ queryKey: betHistoryQueryKey });
      }
    });
    socket.on(RoundEvent.BET_REJECTED, (event: BetRejectedEvent) => {
      const { bet, reject } = useBetStore.getState();
      // No money moved on rejection, so the wallet balance is not refetched here.
      if (bet?.betId === event.betId) {
        reject(event.betId);
        notifyBetRejected();
        void queryClient.invalidateQueries({ queryKey: betHistoryQueryKey });
      }
    });
    socket.on(RoundEvent.BET_CASHED_OUT, (event: BetCashedOutEvent) => {
      useParticipantsStore.getState().cashOut(event);
      const { bet, cashOut } = useBetStore.getState();
      // Backstop: if the HTTP cash-out response was lost, this public event still reconciles the bet to Cashed Out (idempotent).
      if (bet?.betId === event.betId) {
        cashOut({
          betId: event.betId,
          cashedOutMultiplier: event.multiplierHundredths,
          payoutCents: event.payoutCents,
        });
        void queryClient.invalidateQueries({ queryKey: betHistoryQueryKey });
      }
    });

    return () => {
      active = false;
      socket.disconnect();
    };
  }, []);
}
