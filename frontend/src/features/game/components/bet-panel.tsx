import { useState } from "react";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { WalletIcon, ZapIcon } from "lucide-react";
import { RoundPhase } from "../round-contracts";
import { useRoundStore } from "../round-store";
import { useBetStore, type ActiveBet } from "../bet-store";
import { useLiveMultiplier } from "../use-live-multiplier";
import { BetStatus, cashOutBet, placeBet } from "../bet-api";
import {
  notifyBetError,
  notifyCashOutSuccess,
  notifyLateCashOut,
} from "../game-toasts";
import { queryClient } from "@/lib/query-client";
import { walletQueryKey } from "@/features/wallet";
import { formatCents, formatMultiplier } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Panel, PanelHeader } from "./panel";

// README stake bounds: R$1,00–R$1.000,00, held as integer cents (ADR-0004). Mirrors the server's
// MIN/MAX so the button disables before a request that the API would reject anyway.
const MIN_STAKE_CENTS = 100;
const MAX_STAKE_CENTS = 100_000;

// The payout credit lands asynchronously after cash out (ADR-0001), so we add it to the balance
// optimistically and refetch a moment later to reconcile — by then the unconditional credit has
// landed, so the refetch confirms rather than corrects the optimistic value.
const BALANCE_RECONCILE_DELAY_MS = 2_000;

// Spread across the R$1–R$1.000 range (not clustered at the low end): ~0.5% / 5% / 25% / 100%.
const QUICK_STAKES = [
  { label: "R$ 5", value: "5,00" },
  { label: "R$ 50", value: "50,00" },
  { label: "R$ 250", value: "250,00" },
  { label: "R$ 1.000", value: "1.000,00" },
];

interface WalletData {
  playerId: string;
  balance: number;
}

export function BetPanel({ className }: { className?: string }) {
  const roundNumber = useRoundStore((state) => state.roundNumber);
  const bet = useBetStore((state) => state.bet);

  // One Bet per Round (CONTEXT.md): if the player has a Bet on the Round in progress, show its
  // status (and the cash-out control) instead of the form. A Bet left over from a previous Round
  // falls through to the form.
  const betThisRound = bet && bet.roundNumber === roundNumber ? bet : null;

  return (
    <Panel
      className={cn(
        "border-primary/25 shadow-[var(--shadow-panel),0_0_0_1px_rgb(132_255_52_/_0.12)]",
        className,
      )}
    >
      <PanelHeader
        title="Sua aposta"
        icon={<ZapIcon className="size-4 text-primary" />}
      />
      {betThisRound ? <ActiveBetView bet={betThisRound} /> : <PlaceBetForm />}
    </Panel>
  );
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
      notifyCashOutSuccess({
        multiplierHundredths: result.cashedOutMultiplier,
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
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        notifyLateCashOut();
        return;
      }
      notifyBetError("Não foi possível sacar. Tente novamente.");
    },
  });

  const isRunning = phase === RoundPhase.RUNNING;
  const isTerminal =
    phase === RoundPhase.CRASHED || phase === RoundPhase.SETTLED;
  const isConfirmed = bet.status === BetStatus.CONFIRMED;
  // Derived (ADR-0001): a Confirmed bet that never cashed out has Lost once the Round is terminal.
  const isLost = isConfirmed && isTerminal;
  // Derived (ADR-0001): a bet still Pending once Betting has closed missed the window and is Voided.
  const isVoided =
    bet.status === BetStatus.VOIDED ||
    (bet.status === BetStatus.PENDING && (isRunning || isTerminal));

  const canCashOut = isConfirmed && isRunning && !mutation.isPending;
  const potentialPayoutCents =
    liveMultiplier !== null
      ? Math.round(bet.stakeCents * liveMultiplier)
      : bet.stakeCents;

  const showCashOut =
    (isConfirmed && isRunning) ||
    mutation.isPending ||
    bet.status === BetStatus.PENDING;

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-3 rounded-2xl bg-black/20 px-3.5 py-3">
        <span className="text-xs text-muted-foreground">Sua aposta</span>
        <span className="font-black tabular-nums text-white">
          {formatCents(bet.stakeCents)}
        </span>
      </div>

      <BetStatusLabel
        status={bet.status}
        isLost={isLost}
        isVoided={isVoided}
        cashedOutMultiplier={bet.cashedOutMultiplier}
        payoutCents={bet.payoutCents}
      />

      {showCashOut && (
        <button
          type="button"
          disabled={!canCashOut}
          onClick={() => canCashOut && mutation.mutate()}
          className={cn(
            "mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-[1.25rem] text-[17px] font-black transition-[transform,background,box-shadow] active:translate-y-px",
            canCashOut
              ? "bg-success text-success-foreground shadow-glow-emerald hover:bg-success/90"
              : "cursor-not-allowed bg-white/5 text-muted-foreground",
          )}
        >
          <WalletIcon className="size-[18px]" />
          {mutation.isPending
            ? "Sacando…"
            : canCashOut
              ? `Sacar ${formatCents(potentialPayoutCents)}`
              : bet.status === BetStatus.PENDING
                ? "Confirmando…"
                : "Aguarde a rodada"}
        </button>
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
      <p className="text-sm font-black text-success">
        Sacou em {formatMultiplier(multiplier)} (+
        {formatCents(payoutCents ?? 0)})
      </p>
    );
  }
  if (status === BetStatus.REJECTED) {
    return (
      <p className="text-sm font-medium text-destructive">
        Recusada — saldo insuficiente
      </p>
    );
  }
  if (isLost) {
    return <p className="text-sm font-medium text-destructive">Perdeu</p>;
  }
  if (isVoided) {
    return <p className="text-sm text-muted-foreground">Anulada</p>;
  }
  if (status === BetStatus.CONFIRMED) {
    return <p className="text-sm font-bold text-primary">Confirmada</p>;
  }
  return <p className="text-sm text-muted-foreground">Pendente…</p>;
}

function PlaceBetForm() {
  const phase = useRoundStore((state) => state.phase);
  const placePending = useBetStore((state) => state.placePending);
  const [stake, setStake] = useState("10,00");

  const mutation = useMutation({
    mutationFn: placeBet,
    onSuccess: (placed) =>
      placePending({
        betId: placed.betId,
        roundNumber: placed.roundNumber,
        stakeCents: placed.stakeCents,
        status: placed.status,
      }),
    onError: (error) => notifyBetError(betErrorMessage(error)),
  });

  const isBetting = phase === RoundPhase.BETTING;
  const stakeCents = reaisToCents(stake);
  const isStakeValid =
    stakeCents !== null &&
    stakeCents >= MIN_STAKE_CENTS &&
    stakeCents <= MAX_STAKE_CENTS;
  const showRangeError = !isStakeValid && stake.trim() !== "";
  const canBet = isBetting && isStakeValid && !mutation.isPending;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canBet && stakeCents !== null) {
          mutation.mutate(stakeCents);
        }
      }}
    >
      <label
        htmlFor="stake"
        className="text-xs font-medium text-muted-foreground"
      >
        Valor da aposta
      </label>
      <div
        className={cn(
          "mt-1.5 flex items-center gap-2 rounded-2xl border bg-black/25 px-3.5 transition-colors focus-within:border-primary/50",
          showRangeError ? "border-destructive/50" : "border-border",
        )}
      >
        <span className="font-bold text-muted-foreground">R$</span>
        <input
          id="stake"
          inputMode="decimal"
          value={stake}
          disabled={!isBetting || mutation.isPending}
          onChange={(event) => setStake(event.target.value)}
          aria-invalid={showRangeError}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-base font-black tabular-nums text-white outline-none disabled:opacity-60"
        />
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground/70">
        mín R$ 1,00 / máx R$ 1.000,00
      </p>

      <div className="mt-2.5 flex gap-2">
        {QUICK_STAKES.map((quick) => (
          <button
            key={quick.value}
            type="button"
            disabled={!isBetting}
            onClick={() => setStake(quick.value)}
            className="flex-1 rounded-lg border border-border bg-white/4 py-2 text-xs font-bold text-foreground transition-colors hover:bg-white/9 hover:text-white disabled:opacity-50"
          >
            {quick.label}
          </button>
        ))}
      </div>

      <button
        type="submit"
        disabled={!canBet}
        className={cn(
          "mt-3.5 flex h-13 w-full items-center justify-center gap-2 rounded-[1.25rem] text-[15px] font-black transition-[transform,background,box-shadow] active:translate-y-px",
          canBet
            ? "bg-primary text-primary-foreground shadow-glow-lime hover:bg-primary/90"
            : "cursor-not-allowed bg-white/5 text-muted-foreground",
        )}
      >
        <ZapIcon className="size-[18px]" />
        {mutation.isPending
          ? "Apostando…"
          : isBetting
            ? "Apostar"
            : "Aguarde a próxima rodada"}
      </button>

      {showRangeError && (
        <p className="mt-2 text-xs font-medium text-destructive">
          A aposta deve estar entre R$ 1,00 e R$ 1.000,00.
        </p>
      )}
    </form>
  );
}

// pt-BR currency text -> integer cents. Strips thousands dots, treats the comma as the decimal.
function reaisToCents(value: string): number | null {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  if (normalized === "") return null;
  const reais = Number(normalized);
  if (!Number.isFinite(reais)) return null;
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
