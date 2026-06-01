import { useRoundHistoryQuery } from "../round-api";
import { formatMultiplier } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

// Crash Points read at a glance: low rounds (a quick bust) muted-red, the common middle band
// green, and the rare high multipliers highlighted.
function chipClass(multiplier: number): string {
  if (multiplier < 2) return "bg-destructive/15 text-destructive";
  if (multiplier < 10) return "bg-emerald-500/15 text-emerald-400";
  return "bg-amber-400/20 text-amber-300";
}

export function HistoryStrip() {
  const { data, isPending, isError } = useRoundHistoryQuery();

  if (isPending) {
    return (
      <div className="flex gap-1.5 overflow-hidden">
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton key={index} className="h-6 w-12 shrink-0 rounded-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-xs text-muted-foreground">
        Não foi possível carregar o histórico.
      </p>
    );
  }

  const points = data.flatMap((round) =>
    round.crashPoint === null
      ? []
      : [
          {
            roundNumber: round.roundNumber,
            multiplier: round.crashPoint / 100,
          },
        ],
  );

  if (points.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem rodadas ainda.</p>;
  }

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {points.map((point) => (
        <span
          key={point.roundNumber}
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${chipClass(point.multiplier)}`}
        >
          {formatMultiplier(point.multiplier)}
        </span>
      ))}
    </div>
  );
}
