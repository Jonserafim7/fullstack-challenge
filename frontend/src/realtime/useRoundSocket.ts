import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { auth } from "@/auth/auth";
import { queryClient } from "@/lib/query-client";
import { fetchCurrentRound, roundHistoryQueryKey } from "@/queries/round";
import {
  RoundEvent,
  useRoundStore,
  type BettingOpenedEvent,
  type CrashedEvent,
  type RunningEvent,
} from "./round-store";

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

    return () => {
      active = false;
      socket.disconnect();
    };
  }, []);
}
