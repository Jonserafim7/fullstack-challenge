import { useState } from "react";
import { ReceiptIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { formatCents, formatMultiplier } from "@/lib/format";
import { cn } from "@/lib/utils";
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
        <ul className="flex flex-col gap-2">
          {data.bets.map((bet) => (
            <li
              key={bet.betId}
              className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-black/20 px-3 py-3 text-sm tabular-nums"
            >
              <span
                className={cn(
                  "grid size-11 place-items-center rounded-2xl text-sm font-black",
                  roundBadgeClassNameFor(bet),
                )}
              >
                #{bet.roundNumber}
              </span>
              <div className="min-w-0">
                <HistoryBetStatusChip bet={bet} />
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {historyBetDetailFor(bet)}
                </p>
              </div>
              <div className="min-w-20 text-right">
                <p className="text-[10px] font-bold tracking-wide text-muted-foreground/60 uppercase">
                  Retorno
                </p>
                <HistoryBetReturn bet={bet} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && data.total > BET_HISTORY_PAGE_SIZE && (
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
    </Panel>
  );
}

function HistoryBetStatusChip({ bet }: { bet: HistoryBet }) {
  const Icon =
    bet.status === BetStatus.LOST ? TrendingDownIcon : TrendingUpIcon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black",
        statusClassNameFor(bet),
      )}
    >
      <Icon className="size-3.5" />
      {statusLabelFor(bet.status)}
    </span>
  );
}

function HistoryBetReturn({ bet }: { bet: HistoryBet }) {
  if (bet.status === BetStatus.CASHED_OUT) {
    return (
      <span className="text-sm font-black text-success tabular-nums">
        +{formatCents(bet.payoutCents ?? 0)}
      </span>
    );
  }
  if (bet.status === BetStatus.LOST) {
    return (
      <span className="text-sm font-black text-destructive tabular-nums">
        R$ 0,00
      </span>
    );
  }
  if (bet.status === BetStatus.CONFIRMED) {
    return (
      <span className="text-sm font-black text-primary tabular-nums">
        em jogo
      </span>
    );
  }
  if (bet.status === BetStatus.PENDING) {
    return (
      <span className="text-sm font-black text-muted-foreground tabular-nums">
        pendente
      </span>
    );
  }
  return (
    <span className="text-sm font-black text-muted-foreground tabular-nums">
      -
    </span>
  );
}

function historyBetDetailFor(bet: HistoryBet): string {
  const stake = formatCents(bet.stakeCents);

  if (bet.status === BetStatus.CASHED_OUT && bet.cashedOutMultiplier !== null) {
    return `${stake} · multiplicador ${formatMultiplier(
      bet.cashedOutMultiplier / 100,
    )}`;
  }
  if (bet.status === BetStatus.CONFIRMED) {
    return `${stake} reservado na rodada`;
  }
  if (bet.status === BetStatus.PENDING) {
    return `${stake} aguardando confirmação`;
  }
  if (bet.status === BetStatus.LOST) {
    return `${stake} · crash antes do saque`;
  }
  if (bet.status === BetStatus.REJECTED) {
    return `${stake} não entrou na rodada`;
  }
  if (bet.status === BetStatus.VOIDED) {
    return `${stake} · rodada anulada`;
  }
  return stake;
}

function statusLabelFor(status: BetStatus): string {
  if (status === BetStatus.CASHED_OUT) return "Sacou";
  if (status === BetStatus.CONFIRMED) return "Confirmada";
  if (status === BetStatus.PENDING) return "Pendente";
  if (status === BetStatus.LOST) return "Perdeu";
  if (status === BetStatus.REJECTED) return "Recusada";
  if (status === BetStatus.VOIDED) return "Anulada";
  return "Pendente";
}

function statusClassNameFor(bet: HistoryBet): string {
  if (bet.status === BetStatus.CASHED_OUT) {
    return "bg-success/15 text-success";
  }
  if (bet.status === BetStatus.CONFIRMED) {
    return "bg-primary/15 text-primary";
  }
  if (bet.status === BetStatus.LOST || bet.status === BetStatus.REJECTED) {
    return "bg-destructive/15 text-destructive";
  }
  return "bg-white/8 text-muted-foreground";
}

function roundBadgeClassNameFor(bet: HistoryBet): string {
  if (bet.status === BetStatus.CASHED_OUT) {
    return "bg-success/15 text-success";
  }
  if (bet.status === BetStatus.CONFIRMED) {
    return "bg-primary/15 text-primary";
  }
  if (bet.status === BetStatus.LOST || bet.status === BetStatus.REJECTED) {
    return "bg-destructive/15 text-destructive";
  }
  return "bg-white/8 text-muted-foreground";
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
