import { RoundPhase } from "../round-contracts";
import { useRoundStore } from "../round-store";
import { useRoundSocket } from "../use-round-socket";
import { useSecondsUntil } from "../use-seconds-until";
import { BetPanel } from "./bet-panel";
import { MultiplierCanvas } from "./multiplier-canvas";
import { HistoryStrip } from "./history-strip";
import { ParticipantsList } from "./participants-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

export function LiveRound() {
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
        <BetPanel />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Jogadores na rodada</p>
          <ParticipantsList />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Últimas rodadas</p>
          <HistoryStrip />
        </div>
      </CardContent>
    </Card>
  );
}
