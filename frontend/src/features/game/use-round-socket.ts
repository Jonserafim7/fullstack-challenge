import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { auth } from "@/lib/auth/auth";
import { queryClient } from "@/lib/query-client";
import { walletQueryKey } from "@/features/wallet";
import { useBetStore } from "./bet-store";
import { fetchCurrentRound, roundHistoryQueryKey } from "./round-api";
import { useRoundStore } from "./round-store";
import {
  RoundEvent,
  type BetCashedOutEvent,
  type BetConfirmedEvent,
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

    socket.on(RoundEvent.BETTING_OPENED, (event: BettingOpenedEvent) =>
      applyBettingOpened(event),
    );
    socket.on(RoundEvent.RUNNING, (event: RunningEvent) => applyRunning(event));
    socket.on(RoundEvent.CRASHED, (event: CrashedEvent) => {
      applyCrashed(event);
      // The just-crashed Round is now terminal; refresh the history strip (ADR-0006).
      void queryClient.invalidateQueries({ queryKey: roundHistoryQueryKey });
    });
    socket.on(RoundEvent.BET_CONFIRMED, (event: BetConfirmedEvent) => {
      const { bet, confirm } = useBetStore.getState();
      // Public event: only react to the client's own bet. Confirmation means the stake left the
      // wallet, so refetch the balance (ADR-0006: TanStack Query owns REST-derived state).
      if (bet?.betId === event.betId) {
        confirm(event.betId);
        void queryClient.invalidateQueries({ queryKey: walletQueryKey });
      }
    });
    socket.on(RoundEvent.BET_CASHED_OUT, (event: BetCashedOutEvent) => {
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
      }
    });

    return () => {
      active = false;
      socket.disconnect();
    };
  }, []);
}
