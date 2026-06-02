import { useState } from "react";
import { HistoryIcon } from "lucide-react";
import { ROUND_HISTORY_PAGE_SIZE, useRoundHistoryQuery } from "../round-api";
import { formatMultiplier } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
  // Page 1 is the live latest ~20 (refreshed by the socket); higher pages browse older rounds.
  const [page, setPage] = useState(1);
  const { data, isPending, isError } = useRoundHistoryQuery(page);
  const [verifyingRound, setVerifyingRound] = useState<number | null>(null);

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <Panel className={className}>
      <PanelHeader
        title="Últimas rodadas"
        icon={<HistoryIcon className="size-4 text-primary" />}
      />
      <HistoryBody
        data={data}
        isPending={isPending}
        isError={isError}
        onVerify={setVerifyingRound}
      />

      {data && data.total > ROUND_HISTORY_PAGE_SIZE && (
        <Pagination className="mt-3">
          <PaginationContent className="w-full justify-between">
            <PaginationItem>
              <PaginationPrevious
                text="Anterior"
                aria-disabled={!hasPrev}
                className={cn(
                  "cursor-pointer",
                  !hasPrev && "pointer-events-none opacity-50",
                )}
                onClick={() =>
                  hasPrev && setPage((current) => Math.max(1, current - 1))
                }
              />
            </PaginationItem>
            <PaginationItem>
              <span className="px-2 text-xs tabular-nums text-muted-foreground">
                {page} / {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                text="Próxima"
                aria-disabled={!hasNext}
                className={cn(
                  "cursor-pointer",
                  !hasNext && "pointer-events-none opacity-50",
                )}
                onClick={() => hasNext && setPage((current) => current + 1)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

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

  const points = data.rounds.flatMap((round) =>
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
