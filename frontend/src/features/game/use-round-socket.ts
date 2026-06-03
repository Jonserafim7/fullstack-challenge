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

// Opens the live Round connection: hydrate the current phase from REST, then apply WebSocket
// deltas (ADR-0003). The socket reaches the games gateway through Kong (path /games/socket.io);
// websocket-only transport skips socket.io's polling so the upgrade passes cleanly. The JWT
// rides in the handshake and is re-read on every (re)connect so a renewed token is used.
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
        // Snapshot hydration is best-effort; the WebSocket deltas will populate state.
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
      // Catch any transition missed while disconnected.
      void hydrateFromSnapshot();
    });
    socket.on("disconnect", () => setConnection("disconnected"));

    socket.on(RoundEvent.BETTING_OPENED, (event: BettingOpenedEvent) => {
      applyBettingOpened(event);
      // A new Round began: the live participants list only shows the Round in progress, so reset it.
      useParticipantsStore.getState().clear();
    });
    socket.on(RoundEvent.RUNNING, (event: RunningEvent) => applyRunning(event));
    socket.on(RoundEvent.CRASHED, (event: CrashedEvent) => {
      applyCrashed(event);
      // The just-crashed Round is now terminal; refresh the history strip (ADR-0006). Any of the
      // player's Confirmed bets just settled (Lost), so refresh their bet history too.
      void queryClient.invalidateQueries({ queryKey: roundHistoryQueryKey });
      void queryClient.invalidateQueries({ queryKey: betHistoryQueryKey });
      // The player was still holding a Confirmed bet when it crashed: they lost it — tell them.
      const ownBet = useBetStore.getState().bet;
      if (
        ownBet?.roundNumber === event.roundNumber &&
        ownBet.status === BetStatus.CONFIRMED
      ) {
        notifyCrashedLost({ crashPointHundredths: event.crashPoint });
      }
    });
    socket.on(RoundEvent.BET_CONFIRMED, (event: BetConfirmedEvent) => {
      // Public event: every client adds the new participant to the live list.
      useParticipantsStore.getState().confirm(event);
      const { bet, confirm } = useBetStore.getState();
      // The client's own bet: confirmation means the stake left the wallet, so refetch the balance
      // and the bet history (ADR-0006: TanStack Query owns REST-derived state).
      if (bet?.betId === event.betId) {
        confirm(event.betId);
        notifyBetConfirmed({ stakeCents: event.amountCents });
        void queryClient.invalidateQueries({ queryKey: walletQueryKey });
        void queryClient.invalidateQueries({ queryKey: betHistoryQueryKey });
      }
    });
    socket.on(RoundEvent.BET_REJECTED, (event: BetRejectedEvent) => {
      const { bet, reject } = useBetStore.getState();
      // Private event: the wallet refused this player's debit. Reflect Rejected on the placer's own
      // bet (no money moved, so the balance is unchanged — no refetch) and refresh their history.
      if (bet?.betId === event.betId) {
        reject(event.betId);
        notifyBetRejected();
        void queryClient.invalidateQueries({ queryKey: betHistoryQueryKey });
      }
    });
    socket.on(RoundEvent.BET_CASHED_OUT, (event: BetCashedOutEvent) => {
      // Public event: every client updates the live list with the cashout.
      useParticipantsStore.getState().cashOut(event);
      const { bet, cashOut } = useBetStore.getState();
      // Backstop for the placer: the HTTP cash-out response normally updates the store and the
      // balance, but if it was lost this public event still reconciles the bet to Cashed Out
      // (idempotent). The payout credit lands asynchronously, so the balance refetches with it.
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
