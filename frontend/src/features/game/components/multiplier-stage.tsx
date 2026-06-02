import { type ReactNode } from "react";
import { ShieldCheckIcon } from "lucide-react";
import { RoundPhase } from "../round-contracts";
import { type ConnectionStatus, useRoundStore } from "../round-store";
import { formatMultiplier } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Panel } from "./panel";
import { MultiplierCanvas } from "./multiplier-canvas";

// The hero of the left column: the animated curve plus its chrome — round number, the round's
// provably-fair commitment (the only fairness surface on the board; verification lives in the
// history dialog), and status pills driven by the real socket connection + round phase.
export function MultiplierStage({ className }: { className?: string }) {
  const connection = useRoundStore((state) => state.connection);
  const roundNumber = useRoundStore((state) => state.roundNumber);
  const phase = useRoundStore((state) => state.phase);
  const seedHash = useRoundStore((state) => state.seedHash);
  const crashPoint = useRoundStore((state) => state.crashPoint);

  const isRunning = phase === RoundPhase.RUNNING;
  const isTerminal =
    phase === RoundPhase.CRASHED || phase === RoundPhase.SETTLED;

  return (
    <Panel className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-[clamp(18px,3vw,24px)] font-black text-white">
          Rodada {roundNumber ? `#${roundNumber}` : "—"}
        </h1>
        <div className="flex flex-wrap justify-end gap-2">
          <ConnectionPill connection={connection} />
          {isRunning && <Pill tone="live">cash out liberado</Pill>}
          {isTerminal && crashPoint !== null && (
            <Pill tone="danger">
              crashou em {formatMultiplier(crashPoint / 100)}
            </Pill>
          )}
        </div>
      </div>

      {seedHash && (
        <p className="mt-2 inline-flex max-w-full items-start gap-1.5 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed break-all text-primary/90">
          <ShieldCheckIcon className="mt-0.5 size-3 shrink-0" />
          <span>
            <span className="text-muted-foreground">commitment</span> {seedHash}
          </span>
        </p>
      )}

      <div className="mt-4">
        <MultiplierCanvas />
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
