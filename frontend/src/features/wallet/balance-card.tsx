import { useBalanceQuery } from "./balance-query";
import { formatCents } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export function BalanceCard() {
  const { data, isPending, isError } = useBalanceQuery();

  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">Saldo</p>
      {isPending ? (
        <Skeleton className="h-9 w-36" />
      ) : isError ? (
        <p className="text-sm text-destructive">
          Não foi possível carregar o saldo.
        </p>
      ) : (
        <p className="text-3xl font-semibold tabular-nums">
          {formatCents(data.balance)}
        </p>
      )}
    </div>
  );
}
