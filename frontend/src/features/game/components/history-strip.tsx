import { useState } from "react";
import { HistoryIcon } from "lucide-react";
import { useRoundHistoryQuery } from "../round-api";
import { formatMultiplier } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel, PanelHeader } from "./panel";
import { RoundVerificationDialog } from "./round-verification-dialog";

// Crash Points read at a glance: low rounds (a quick bust) muted-red, the common middle band
// green, and the rare high multipliers gold.
function chipClass(multiplier: number): string {
  if (multiplier < 2) return "bg-destructive/15 text-destructive";
  if (multiplier < 10) return "bg-success/15 text-success";
  return "bg-warning/20 text-warning";
}

export function HistoryStrip({ className }: { className?: string }) {
  const { data, isPending, isError } = useRoundHistoryQuery();
  const [verifyingRound, setVerifyingRound] = useState<number | null>(null);

  return (
    <Panel className={className}>
      <PanelHeader
        title="Últimas rodadas"
        icon={<HistoryIcon className="size-4 text-primary" />}
        tag="clique p/ verificar"
      />
      <HistoryBody
        data={data}
        isPending={isPending}
        isError={isError}
        onVerify={setVerifyingRound}
      />
      <RoundVerificationDialog
        roundNumber={verifyingRound}
        onOpenChange={(open) => !open && setVerifyingRound(null)}
      />
    </Panel>
  );
}

function HistoryBody({
  data,
  isPending,
  isError,
  onVerify,
}: {
  data: ReturnType<typeof useRoundHistoryQuery>["data"];
  isPending: boolean;
  isError: boolean;
  onVerify: (roundNumber: number) => void;
}) {
  if (isPending) {
    return (
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton key={index} className="h-7 w-14 shrink-0 rounded-full" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-muted-foreground">
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
    return <p className="text-sm text-muted-foreground">Sem rodadas ainda.</p>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {points.map((point) => (
          <button
            key={point.roundNumber}
            type="button"
            onClick={() => onVerify(point.roundNumber)}
            title={`Verificar rodada #${point.roundNumber}`}
            className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-black tabular-nums transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${chipClass(point.multiplier)}`}
          >
            {formatMultiplier(point.multiplier)}
          </button>
        ))}
      </div>
      <p className="mt-2.5 text-[11px] text-muted-foreground/70">
        Cada rodada é pré-comprometida — clique para recalcular a verificação no
        seu navegador.
      </p>
    </>
  );
}
