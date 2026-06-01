import { useState } from "react";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { RoundPhase } from "../round-contracts";
import { useRoundStore } from "../round-store";
import { useBetStore, type ActiveBet } from "../bet-store";
import { useLiveMultiplier } from "../use-live-multiplier";
import { BetStatus, cashOutBet, placeBet } from "../bet-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { queryClient } from "@/lib/query-client";
import { walletQueryKey } from "@/features/wallet";
import { formatCents, formatMultiplier } from "@/lib/format";

// README stake bounds: R$1,00–R$1.000,00, held as integer cents (ADR-0004). Mirrors the server's
// MIN/MAX so the button disables before a request that the API would reject anyway.
const MIN_STAKE_CENTS = 100;
const MAX_STAKE_CENTS = 100_000;

// The payout credit lands asynchronously after cash out (ADR-0001), so we add it to the balance
// optimistically and refetch a moment later to reconcile — by then the unconditional credit has
// landed, so the refetch confirms rather than corrects the optimistic value.
const BALANCE_RECONCILE_DELAY_MS = 2_000;

interface WalletData {
  playerId: string;
  balance: number;
}

export function BetPanel() {
  const roundNumber = useRoundStore((state) => state.roundNumber);
  const bet = useBetStore((state) => state.bet);

  // One Bet per Round (CONTEXT.md): if the player has a Bet on the Round in progress, show its
  // status (and the cash-out control) instead of the form. A Bet left over from a previous Round
  // falls through to the form.
  const betThisRound = bet && bet.roundNumber === roundNumber ? bet : null;
  if (betThisRound) {
    return <ActiveBetView bet={betThisRound} />;
  }

  return <PlaceBetForm />;
}

function ActiveBetView({ bet }: { bet: ActiveBet }) {
  const phase = useRoundStore((state) => state.phase);
  const liveMultiplier = useLiveMultiplier();
  const cashOut = useBetStore((state) => state.cashOut);

  const mutation = useMutation({
    mutationFn: cashOutBet,
    onSuccess: (result) => {
      if (result.cashedOutMultiplier === null || result.payoutCents === null) {
        return;
      }
      cashOut({
        betId: result.betId,
        cashedOutMultiplier: result.cashedOutMultiplier,
        payoutCents: result.payoutCents,
      });
      // Optimistic credit: show the winnings now, then reconcile once the async credit lands.
      queryClient.setQueryData<WalletData>(walletQueryKey, (old) =>
        old ? { ...old, balance: old.balance + result.payoutCents! } : old,
      );
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: walletQueryKey });
      }, BALANCE_RECONCILE_DELAY_MS);
    },
  });

  const isRunning = phase === RoundPhase.RUNNING;
  const isTerminal =
    phase === RoundPhase.CRASHED || phase === RoundPhase.SETTLED;
  const isConfirmed = bet.status === BetStatus.CONFIRMED;
  // Derived (ADR-0001): a Confirmed bet that never cashed out has Lost once the Round is terminal.
  // The server records this authoritatively; the client shows it from the crash it already has.
  const isLost = isConfirmed && isTerminal;
  // Derived (ADR-0001): a bet still Pending once Betting has closed missed the window and is Voided.
  // Self-correcting — a debit that confirmed just in time arrives as bet.confirmed and flips it; a
  // debit that lands too late is voided-then-refunded server-side and never confirms, so it stays.
  const isVoided =
    bet.status === BetStatus.VOIDED ||
    (bet.status === BetStatus.PENDING && (isRunning || isTerminal));

  const canCashOut = isConfirmed && isRunning && !mutation.isPending;
  const potentialPayoutCents =
    liveMultiplier !== null
      ? Math.round(bet.stakeCents * liveMultiplier)
      : bet.stakeCents;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Sua aposta</p>
      <p className="text-sm tabular-nums">
        {formatCents(bet.stakeCents)} —{" "}
        <BetStatusLabel
          status={bet.status}
          isLost={isLost}
          isVoided={isVoided}
          cashedOutMultiplier={bet.cashedOutMultiplier}
          payoutCents={bet.payoutCents}
        />
      </p>

      {(isConfirmed && isRunning) || mutation.isPending ? (
        <Button
          type="button"
          className="w-full"
          disabled={!canCashOut}
          onClick={() => {
            if (canCashOut) {
              mutation.mutate();
            }
          }}
        >
          {mutation.isPending
            ? "Sacando…"
            : `Sacar ${formatCents(potentialPayoutCents)}`}
        </Button>
      ) : null}

      {mutation.isError && (
        <p className="text-xs text-destructive">
          {cashOutErrorMessage(mutation.error)}
        </p>
      )}
    </div>
  );
}

function BetStatusLabel({
  status,
  isLost,
  isVoided,
  cashedOutMultiplier,
  payoutCents,
}: {
  status: BetStatus;
  isLost: boolean;
  isVoided: boolean;
  cashedOutMultiplier: number | null;
  payoutCents: number | null;
}) {
  if (status === BetStatus.CASHED_OUT) {
    const multiplier =
      cashedOutMultiplier !== null ? cashedOutMultiplier / 100 : 1;
    return (
      <span className="font-medium text-emerald-500">
        Sacou em {formatMultiplier(multiplier)} (+
        {formatCents(payoutCents ?? 0)})
      </span>
    );
  }
  if (status === BetStatus.REJECTED) {
    return (
      <span className="text-destructive">Recusada — saldo insuficiente</span>
    );
  }
  if (isLost) {
    return <span className="text-destructive">Perdeu</span>;
  }
  if (isVoided) {
    return <span className="text-muted-foreground">Anulada</span>;
  }
  if (status === BetStatus.CONFIRMED) {
    return <span className="text-primary">Confirmada</span>;
  }
  return <span className="text-muted-foreground">Pendente…</span>;
}

function PlaceBetForm() {
  const phase = useRoundStore((state) => state.phase);
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

function cashOutErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && error.response?.status === 409) {
    return "Tarde demais — a rodada já crashou.";
  }
  return "Não foi possível sacar. Tente novamente.";
}
