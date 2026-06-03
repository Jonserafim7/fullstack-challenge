import { useEffect, useRef, useState } from "react";
import { multiplierAt } from "@crash/crash-curve";
import { RoundPhase } from "./round-contracts";
import { useRoundStore } from "./round-store";

// Anchors on min(now, startedAt) at receipt — no clock sync (ADR-0003) — so it matches the canvas line.
export function useLiveMultiplier(): number | null {
  const phase = useRoundStore((state) => state.phase);
  const roundNumber = useRoundStore((state) => state.roundNumber);
  const startedAt = useRoundStore((state) => state.startedAt);
  const [multiplier, setMultiplier] = useState<number | null>(null);
  const anchor = useRef<{ round: number; anchorMs: number } | null>(null);

  const isRunning = phase === RoundPhase.RUNNING && startedAt !== null;

  useEffect(() => {
    if (!isRunning || roundNumber === null || startedAt === null) {
      anchor.current = null;
      setMultiplier(null);
      return;
    }
    const tick = () => {
      const now = Date.now();
      if (anchor.current?.round !== roundNumber) {
        const serverStartedMs = new Date(startedAt).getTime();
        anchor.current = {
          round: roundNumber,
          anchorMs: Math.min(now, serverStartedMs),
        };
      }
      setMultiplier(multiplierAt({ elapsedMs: now - anchor.current.anchorMs }));
    };
    tick();
    const intervalId = setInterval(tick, 100);
    return () => clearInterval(intervalId);
  }, [isRunning, roundNumber, startedAt]);

  return multiplier;
}
