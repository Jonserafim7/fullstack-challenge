import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { auth } from "@/auth/auth";
import { useBalanceQuery } from "@/queries/balance";
import { RoundPhase } from "@/queries/round";
import { useRoundStore } from "@/realtime/round-store";
import { useRoundSocket } from "@/realtime/useRoundSocket";
import { MultiplierCanvas } from "@/realtime/multiplier-canvas";
import { HistoryStrip } from "@/realtime/history-strip";
import { formatCents } from "@/lib/format";
import { useSecondsUntil } from "@/lib/use-seconds-until";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    await context.auth.ensureInitialized();
    if (!context.auth.isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
  },
  component: Home,
});

function Home() {
  const router = useRouter();
  const { data, isPending, isError } = useBalanceQuery();

  async function handleLogout() {
    await auth.logout();
    router.navigate({ to: "/login" });
  }

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Crash Game</CardTitle>
            <CardDescription>
              Bem-vindo, {auth.username ?? "jogador"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
            <Button variant="outline" className="w-full" onClick={handleLogout}>
              Sair
            </Button>
          </CardContent>
        </Card>

        <LiveRound />
      </div>
    </main>
  );
}

const phaseLabels: Record<RoundPhase, string> = {
  BETTING: "Apostas abertas",
  RUNNING: "Em andamento",
  CRASHED: "Crashou",
  SETTLED: "Encerrada",
};

const connectionLabels: Record<string, string> = {
  connecting: "conectando…",
  connected: "ao vivo",
  disconnected: "desconectado",
};

function LiveRound() {
  useRoundSocket();
  const connection = useRoundStore((state) => state.connection);
  const roundNumber = useRoundStore((state) => state.roundNumber);
  const phase = useRoundStore((state) => state.phase);
  const bettingEndsAt = useRoundStore((state) => state.bettingEndsAt);

  const isBetting = phase === RoundPhase.BETTING;
  const secondsToClose = useSecondsUntil(isBetting ? bettingEndsAt : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Rodada {roundNumber ? `#${roundNumber}` : "—"}</span>
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            {connectionLabels[connection]}
          </span>
        </CardTitle>
        <CardDescription>
          {phase ? phaseLabels[phase] : "Aguardando rodada…"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <MultiplierCanvas />
        {isBetting && secondsToClose !== null && (
          <p className="text-center text-sm text-muted-foreground">
            Apostas fecham em{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {secondsToClose.toFixed(1)}s
            </span>
          </p>
        )}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Últimas rodadas</p>
          <HistoryStrip />
        </div>
      </CardContent>
    </Card>
  );
}
