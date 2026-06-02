import { type ReactNode } from "react";
import { ShieldCheckIcon } from "lucide-react";
import { RoundPhase } from "../round-contracts";
import { type ConnectionStatus, useRoundStore } from "../round-store";
import { useSecondsUntil } from "../use-seconds-until";
import { formatMultiplier } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Panel } from "./panel";
import { MultiplierCanvas } from "./multiplier-canvas";

// Radial-glow backdrops behind the curve — lime while the round is live, red once it crashed.
const LIVE_GLOW =
  "radial-gradient(circle at 60% 42%, rgb(132 255 52 / 0.16), transparent 38%), linear-gradient(180deg, rgb(29 38 54 / 0.6), rgb(3 8 7 / 0.95))";
const CRASHED_GLOW =
  "radial-gradient(circle at 60% 42%, rgb(255 54 83 / 0.18), transparent 38%), linear-gradient(180deg, rgb(40 20 26 / 0.6), rgb(3 8 7 / 0.95))";

// The hero of the left column: the animated curve plus its chrome — round number, the round's
// provably-fair commitment (the only fairness surface on the board; verification lives in the
// history dialog), and status pills driven by the real socket connection + round phase.
export function MultiplierStage({ className }: { className?: string }) {
  const connection = useRoundStore((state) => state.connection);
  const roundNumber = useRoundStore((state) => state.roundNumber);
  const phase = useRoundStore((state) => state.phase);
  const bettingEndsAt = useRoundStore((state) => state.bettingEndsAt);
  const seedHash = useRoundStore((state) => state.seedHash);
  const crashPoint = useRoundStore((state) => state.crashPoint);

  const isBetting = phase === RoundPhase.BETTING;
  const isRunning = phase === RoundPhase.RUNNING;
  const isTerminal =
    phase === RoundPhase.CRASHED || phase === RoundPhase.SETTLED;
  const secondsToClose = useSecondsUntil(isBetting ? bettingEndsAt : null);

  return (
    <Panel className={cn("relative overflow-hidden", className)}>
      <div
        className="absolute inset-0 transition-[background] duration-500"
        style={{ background: isTerminal ? CRASHED_GLOW : LIVE_GLOW }}
      />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[clamp(18px,3vw,24px)] font-black text-white">
              Rodada {roundNumber ? `#${roundNumber}` : "—"}
            </h1>
            {seedHash && (
              <p
                className="mt-1.5 inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 font-mono text-[11px] text-primary/90"
                title={seedHash}
              >
                <ShieldCheckIcon className="size-3 shrink-0" />
                commitment {seedHash.slice(0, 24)}…
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <ConnectionPill connection={connection} />
            {isBetting && secondsToClose !== null && (
              <Pill tone="neutral">fecha em {secondsToClose.toFixed(1)}s</Pill>
            )}
            {isRunning && <Pill tone="live">cash out liberado</Pill>}
            {isTerminal && crashPoint !== null && (
              <Pill tone="danger">
                crashou em {formatMultiplier(crashPoint / 100)}
              </Pill>
            )}
          </div>
        </div>

        <div className="mt-4">
          <MultiplierCanvas />
        </div>
      </div>
    </Panel>
  );
}

function ConnectionPill({ connection }: { connection: ConnectionStatus }) {
  if (connection === "connected")
    return (
      <Pill tone="live" pulse>
        ao vivo
      </Pill>
    );
  if (connection === "connecting")
    return <Pill tone="neutral">conectando…</Pill>;
  return <Pill tone="danger">offline</Pill>;
}

type PillTone = "live" | "neutral" | "danger";

const PILL_TONES: Record<PillTone, string> = {
  live: "bg-primary/15 text-primary",
  neutral: "bg-white/8 text-foreground",
  danger: "bg-destructive/15 text-destructive",
};

function Pill({
  tone,
  pulse = false,
  children,
}: {
  tone: PillTone;
  pulse?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black whitespace-nowrap",
        PILL_TONES[tone],
      )}
    >
      {pulse && (
        <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)] motion-safe:animate-pulse" />
      )}
      {children}
    </span>
  );
}
