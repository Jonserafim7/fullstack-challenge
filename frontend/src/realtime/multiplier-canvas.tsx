import { useEffect, useRef } from "react";
import { elapsedMsToReach, multiplierAt } from "@crash/crash-curve";
import { RoundPhase } from "@/queries/round";
import { formatMultiplier } from "@/lib/format";
import { useRoundStore } from "./round-store";

// The rising multiplier is drawn off React state (ADR-0006): a requestAnimationFrame loop
// reads the live store via getState() and paints the curve, so the 60fps redraw never
// re-renders React. The curve is m(t) from @crash/crash-curve — the same growth function the
// games engine uses to time each Crash, so the drawn line can never drift from the backend
// (ADR-0003). It anchors at round.running and snaps to the authoritative Crash Point on
// round.crashed.

const RISING_COLOR = "#34d399";
const CRASHED_COLOR = "#f87171";
const CRASH_FLASH_MS = 600;
const CURVE_SAMPLES = 120;

export function MultiplierCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const readout = readoutRef.current;
    if (!canvas || !readout) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frameId = 0;
    let anchorMs = 0;
    let anchoredRound: number | null = null;
    let crashFlashStartMs: number | null = null;
    let flashedRound: number | null = null;

    const render = () => {
      const now = Date.now();
      const { phase, roundNumber, startedAt, crashPoint } =
        useRoundStore.getState();

      let displayMultiplier = 1;
      let drawnElapsedMs = 0;
      // CRASHED and SETTLED are both terminal: hold the frozen Crash Point either way, so a
      // SETTLED snapshot arriving on reconnect never blanks the curve back to 1.00x.
      const isTerminal =
        (phase === RoundPhase.CRASHED || phase === RoundPhase.SETTLED) &&
        crashPoint !== null;

      if (phase === RoundPhase.RUNNING && startedAt) {
        if (anchoredRound !== roundNumber) {
          // Anchor t≈0 on receipt; back-dating only places a late joiner at the right point on
          // the curve (ADR-0003 — no clock sync). min() clamps a server clock that runs ahead.
          const serverStartedMs = new Date(startedAt).getTime();
          anchorMs = Math.min(now, serverStartedMs);
          anchoredRound = roundNumber;
        }
        drawnElapsedMs = now - anchorMs;
        displayMultiplier = multiplierAt({ elapsedMs: drawnElapsedMs });
      } else if (isTerminal) {
        if (flashedRound !== roundNumber) {
          crashFlashStartMs = now;
          flashedRound = roundNumber;
        }
        displayMultiplier = crashPoint / 100;
        drawnElapsedMs = elapsedMsToReach({ multiplier: displayMultiplier });
      }

      const crashFade =
        isTerminal && crashFlashStartMs !== null
          ? Math.max(0, 1 - (now - crashFlashStartMs) / CRASH_FLASH_MS)
          : 0;

      drawScene(ctx, canvas, {
        displayMultiplier,
        drawnElapsedMs,
        isTerminal,
        crashFade,
      });

      readout.textContent = formatMultiplier(displayMultiplier);
      readout.style.color = isTerminal ? CRASHED_COLOR : "#f8fafc";

      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="relative h-56 w-full overflow-hidden rounded-lg border bg-card">
      <canvas ref={canvasRef} className="h-full w-full" />
      <span
        ref={readoutRef}
        className="pointer-events-none absolute inset-0 grid place-items-center text-5xl font-bold tabular-nums"
      >
        1.00x
      </span>
    </div>
  );
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  {
    displayMultiplier,
    drawnElapsedMs,
    isTerminal,
    crashFade,
  }: {
    displayMultiplier: number;
    drawnElapsedMs: number;
    isTerminal: boolean;
    crashFade: number;
  },
) {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  if (
    canvas.width !== Math.round(cssWidth * dpr) ||
    canvas.height !== Math.round(cssHeight * dpr)
  ) {
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const padX = 10;
  const padY = 16;
  const left = padX;
  const right = cssWidth - padX;
  const top = padY;
  const bottom = cssHeight - padY;

  // The y-axis ceiling follows the current multiplier with headroom so the rising line always
  // stays in view; the x-axis fits the whole elapsed window into the width as it grows.
  const ceiling = Math.max(2, displayMultiplier) * 1.15;
  const elapsedDenom = Math.max(drawnElapsedMs, 1);
  const xForTime = (t: number) => left + (t / elapsedDenom) * (right - left);
  const yForMultiplier = (m: number) =>
    bottom - ((m - 1) / (ceiling - 1)) * (bottom - top);

  const color = isTerminal ? CRASHED_COLOR : RISING_COLOR;

  // Sample the curve once, then reuse the points for both the fill and the stroke.
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= CURVE_SAMPLES; i++) {
    const t = (i / CURVE_SAMPLES) * drawnElapsedMs;
    points.push([xForTime(t), yForMultiplier(multiplierAt({ elapsedMs: t }))]);
  }
  const tipX = xForTime(drawnElapsedMs);
  const tipY = yForMultiplier(displayMultiplier);

  const tracePath = () => {
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const [x, y] = points[i];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };

  // Translucent fill under the curve, then the stroke on top.
  tracePath();
  ctx.lineTo(tipX, bottom);
  ctx.lineTo(left, bottom);
  ctx.closePath();
  ctx.fillStyle = isTerminal
    ? "rgba(248, 113, 113, 0.12)"
    : "rgba(52, 211, 153, 0.12)";
  ctx.fill();

  tracePath();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();

  // The crash burst: a red glow at the tip that fades over CRASH_FLASH_MS.
  if (crashFade > 0) {
    ctx.beginPath();
    ctx.arc(tipX, tipY, 6 + 40 * (1 - crashFade), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(248, 113, 113, ${0.45 * crashFade})`;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(tipX, tipY, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}
