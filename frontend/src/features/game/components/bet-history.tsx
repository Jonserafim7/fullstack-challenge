import { useState } from "react";
import { ReceiptIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCents, formatMultiplier } from "@/lib/format";
import { BetStatus } from "../bet-api";
import {
  BET_HISTORY_PAGE_SIZE,
  useBetHistoryQuery,
  type HistoryBet,
} from "../bet-history-api";
import { Panel, PanelHeader } from "./panel";

export function BetHistory({ className }: { className?: string }) {
  const [page, setPage] = useState(1);
  const { data, isPending, isError } = useBetHistoryQuery(page);

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <Panel className={className}>
      <PanelHeader
        title="Minhas apostas"
        icon={<ReceiptIcon className="size-4 text-primary" />}
      />
      {isPending ? (
        <BetHistorySkeleton />
      ) : isError ? (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar suas apostas.
        </p>
      ) : data.bets.length === 0 ? (
        <p className="text-sm text-muted-foreground">Você ainda não apostou.</p>
      ) : (
        <ul className="flex flex-col">
          {data.bets.map((bet) => (
            <li
              key={bet.betId}
              className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm tabular-nums last:border-b-0"
            >
              <span className="text-muted-foreground">
                Rodada #{bet.roundNumber}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-white">
                  {formatCents(bet.stakeCents)}
                </span>
                <HistoryBetStatus bet={bet} />
              </span>
            </li>
          ))}
        </ul>
      )}

      {data && data.total > BET_HISTORY_PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasPrev}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Anterior
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasNext}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </Panel>
  );
}

function HistoryBetStatus({ bet }: { bet: HistoryBet }) {
  if (bet.status === BetStatus.CASHED_OUT && bet.cashedOutMultiplier !== null) {
    return (
      <span className="font-medium text-success">
        sacou em {formatMultiplier(bet.cashedOutMultiplier / 100)} (+
        {formatCents(bet.payoutCents ?? 0)})
      </span>
    );
  }
  if (bet.status === BetStatus.LOST) {
    return <span className="text-destructive">perdeu</span>;
  }
  if (bet.status === BetStatus.REJECTED) {
    return <span className="text-destructive">recusada</span>;
  }
  if (bet.status === BetStatus.VOIDED) {
    return <span className="text-muted-foreground">anulada</span>;
  }
  if (bet.status === BetStatus.CONFIRMED) {
    return <span className="text-primary">confirmada</span>;
  }
  return <span className="text-muted-foreground">pendente</span>;
}

function BetHistorySkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-5 w-full" />
      ))}
    </div>
  );
}
