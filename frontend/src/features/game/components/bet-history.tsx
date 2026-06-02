import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCents, formatMultiplier } from "@/lib/format";
import { BetStatus } from "../bet-api";
import {
  BET_HISTORY_PAGE_SIZE,
  useBetHistoryQuery,
  type HistoryBet,
} from "../bet-history-api";

export function BetHistory() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError } = useBetHistoryQuery(page);

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suas apostas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending ? (
          <BetHistorySkeleton />
        ) : isError ? (
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar suas apostas.
          </p>
        ) : data.bets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Você ainda não apostou.
          </p>
        ) : (
          <ul className="space-y-1">
            {data.bets.map((bet) => (
              <li
                key={bet.betId}
                className="flex items-center justify-between gap-2 text-sm tabular-nums"
              >
                <span className="text-muted-foreground">
                  Rodada #{bet.roundNumber}
                </span>
                <span className="flex items-center gap-2">
                  <span>{formatCents(bet.stakeCents)}</span>
                  <HistoryBetStatus bet={bet} />
                </span>
              </li>
            ))}
          </ul>
        )}

        {data && data.total > BET_HISTORY_PAGE_SIZE && (
          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasPrev}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
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
      </CardContent>
    </Card>
  );
}

function HistoryBetStatus({ bet }: { bet: HistoryBet }) {
  if (bet.status === BetStatus.CASHED_OUT && bet.cashedOutMultiplier !== null) {
    return (
      <span className="font-medium text-emerald-500">
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
    <div className="space-y-1.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-5 w-full" />
      ))}
    </div>
  );
}
