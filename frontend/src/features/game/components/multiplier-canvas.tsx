import { useEffect, useRef } from "react";
import { ClockIcon, ShieldCheckIcon, ZapIcon } from "lucide-react";
import { elapsedMsToReach, multiplierAt } from "@crash/crash-curve";
import { RoundPhase } from "../round-contracts";
import { formatMultiplier } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRoundStore } from "../round-store";
import { useSecondsUntil } from "../use-seconds-until";

const RISING_COLOR = "#34d399";
const CRASHED_COLOR = "#f87171";
const CRASH_FLASH_MS = 600;
const CURVE_SAMPLES = 120;

const LIVE_GLOW =
  "radial-gradient(circle at 50% 54%, rgb(132 255 52 / 0.18), transparent 62%)";
const CRASHED_GLOW =
  "radial-gradient(circle at 50% 54%, rgb(255 54 83 / 0.20), transparent 62%)";
const IDLE_GLOW =
  "radial-gradient(circle at 50% 54%, rgb(132 255 52 / 0.06), transparent 62%)";

export function MultiplierCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const phase = useRoundStore((state) => state.phase);
  const bettingEndsAt = useRoundStore((state) => state.bettingEndsAt);
  const secondsToClose = useSecondsUntil(
    phase === RoundPhase.BETTING ? bettingEndsAt : null,
  );

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
          // Anchored at round.running without clock sync (ADR-0003); min() clamps a server clock that runs ahead.
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
      if (isTerminal) {
        readout.style.color = CRASHED_COLOR;
        readout.style.textShadow = "0 0 36px rgb(248 113 113 / 0.5)";
      } else if (phase === RoundPhase.RUNNING) {
        readout.style.color = "#f8fafc";
        readout.style.textShadow = "0 0 36px rgb(132 255 52 / 0.4)";
      } else {
        readout.style.color = "#f8fafc";
        readout.style.textShadow = "none";
      }

      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const isTerminal =
    phase === RoundPhase.CRASHED || phase === RoundPhase.SETTLED;
  const stageGlow = isTerminal
    ? CRASHED_GLOW
    : phase === RoundPhase.RUNNING
      ? LIVE_GLOW
      : IDLE_GLOW;
  const sub = subFor({ phase, secondsToClose });

  return (
    <div className="relative h-[clamp(260px,42vh,400px)] w-full overflow-hidden rounded-panel border border-border bg-black/40">
      <div
        className="pointer-events-none absolute inset-0 transition-[background] duration-500"
        style={{ background: stageGlow }}
      />
      <canvas ref={canvasRef} className="relative h-full w-full" />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span
          ref={readoutRef}
          className="text-[clamp(54px,11vw,104px)] leading-[0.9] font-black tracking-tight text-slate-50 tabular-nums"
        >
          1.00x
        </span>
        <span
          className={cn(
            "mt-3.5 inline-flex items-center gap-2 rounded-full border border-border bg-black/40 px-4 py-2 text-sm font-semibold",
            isTerminal ? "text-destructive" : "text-foreground",
          )}
        >
          <sub.Icon
            className={cn(
              "size-4",
              isTerminal ? "text-destructive" : "text-primary",
            )}
          />
          {sub.text}
        </span>
      </div>
    </div>
  );
}

function subFor({
  phase,
  secondsToClose,
}: {
  phase: RoundPhase | null;
  secondsToClose: number | null;
}) {
  if (phase === RoundPhase.BETTING) {
    const timeText =
      secondsToClose === null
        ? "janela de apostas aberta"
        : `fecha em ${secondsToClose.toFixed(1)}s`;
    return { Icon: ClockIcon, text: `Apostas abertas — ${timeText}` };
  }
  if (phase === RoundPhase.RUNNING)
    return { Icon: ZapIcon, text: "Saque antes do crash" };
  if (phase === RoundPhase.CRASHED || phase === RoundPhase.SETTLED)
    return {
      Icon: ShieldCheckIcon,
      text: "Crash revelado — nova rodada já vem",
    };
  return { Icon: ClockIcon, text: "Aguardando rodada…" };
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

  // Nothing to draw before the round starts — a degenerate origin point shows as a stray dot.
  if (!isTerminal && drawnElapsedMs < 1) {
    return;
  }

  const padX = 16;
  const padY = 22;
  const left = padX;
  const right = cssWidth - padX;
  const top = padY;
  const bottom = cssHeight - padY;

  const ceiling = Math.max(2, displayMultiplier) * 1.15;
  const elapsedDenom = Math.max(drawnElapsedMs, 1);
  const xForTime = (t: number) => left + (t / elapsedDenom) * (right - left);
  const yForMultiplier = (m: number) =>
    bottom - ((m - 1) / (ceiling - 1)) * (bottom - top);

  const color = isTerminal ? CRASHED_COLOR : RISING_COLOR;

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

  tracePath();
  ctx.lineTo(tipX, bottom);
  ctx.lineTo(left, bottom);
  ctx.closePath();
  ctx.fillStyle = isTerminal
    ? "rgba(248, 113, 113, 0.12)"
    : "rgba(52, 211, 153, 0.12)";
  ctx.fill();

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  tracePath();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();

  if (crashFade > 0) {
    ctx.beginPath();
    ctx.arc(tipX, tipY, 6 + 46 * (1 - crashFade), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(248, 113, 113, ${0.45 * crashFade})`;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(tipX, tipY, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}
