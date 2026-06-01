import { useState } from "react";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { RoundPhase } from "../round-contracts";
import { useRoundStore } from "../round-store";
import { useBetStore } from "../bet-store";
import { BetStatus, placeBet } from "../bet-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/format";

// README stake bounds: R$1,00–R$1.000,00, held as integer cents (ADR-0004). Mirrors the server's
// MIN/MAX so the button disables before a request that the API would reject anyway.
const MIN_STAKE_CENTS = 100;
const MAX_STAKE_CENTS = 100_000;

export function BetPanel() {
  const phase = useRoundStore((state) => state.phase);
  const roundNumber = useRoundStore((state) => state.roundNumber);
  const bet = useBetStore((state) => state.bet);
  const placePending = useBetStore((state) => state.placePending);
  const [stake, setStake] = useState("5.00");

  const mutation = useMutation({
    mutationFn: placeBet,
    onSuccess: (placed) =>
      placePending({
        betId: placed.betId,
        roundNumber: placed.roundNumber,
        stakeCents: placed.stakeCents,
        status: placed.status,
      }),
  });

  // One Bet per Round (CONTEXT.md): if the player has a Bet on the Round in progress, show its
  // status instead of the form. A Bet left over from a previous Round falls through to the form.
  const betThisRound = bet && bet.roundNumber === roundNumber ? bet : null;
  if (betThisRound) {
    const isConfirmed = betThisRound.status === BetStatus.CONFIRMED;
    return (
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Sua aposta</p>
        <p className="text-sm tabular-nums">
          {formatCents(betThisRound.stakeCents)} —{" "}
          <span
            className={isConfirmed ? "text-primary" : "text-muted-foreground"}
          >
            {isConfirmed ? "Confirmada" : "Pendente…"}
          </span>
        </p>
      </div>
    );
  }

  const isBetting = phase === RoundPhase.BETTING;
  const stakeCents = reaisToCents(stake);
  const isStakeValid =
    stakeCents !== null &&
    stakeCents >= MIN_STAKE_CENTS &&
    stakeCents <= MAX_STAKE_CENTS;
  const canBet = isBetting && isStakeValid && !mutation.isPending;

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (canBet) {
          mutation.mutate(stakeCents);
        }
      }}
    >
      <label htmlFor="stake" className="text-sm text-muted-foreground">
        Aposta (R$)
      </label>
      <div className="flex gap-2">
        <Input
          id="stake"
          type="number"
          min="1"
          max="1000"
          step="0.01"
          value={stake}
          onChange={(event) => setStake(event.target.value)}
          disabled={!isBetting || mutation.isPending}
          aria-invalid={!isStakeValid}
        />
        <Button type="submit" disabled={!canBet}>
          {mutation.isPending ? "Apostando…" : "Apostar"}
        </Button>
      </div>
      {!isStakeValid && stake.trim() !== "" && (
        <p className="text-xs text-destructive">
          A aposta deve estar entre R$ 1,00 e R$ 1.000,00.
        </p>
      )}
      {mutation.isError && (
        <p className="text-xs text-destructive">
          {betErrorMessage(mutation.error)}
        </p>
      )}
      {!isBetting && (
        <p className="text-xs text-muted-foreground">
          Aguarde a próxima rodada para apostar.
        </p>
      )}
    </form>
  );
}

function reaisToCents(value: string): number | null {
  const reais = Number(value);
  if (!Number.isFinite(reais)) {
    return null;
  }
  return Math.round(reais * 100);
}

function betErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 409) {
      return "Apostas fechadas ou você já apostou nesta rodada.";
    }
    const data = error.response?.data as { message?: string } | undefined;
    if (typeof data?.message === "string") {
      return data.message;
    }
  }
  return "Não foi possível apostar. Tente novamente.";
}
