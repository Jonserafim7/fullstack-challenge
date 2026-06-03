import { BetStatus, RoundPhase } from "./round-contracts";

// The Bet's display state, derived from its status and the current Round phase — the logic the bet
// panel renders from. Pure so it can be unit-tested without mounting the panel (ADR-0001):
//   - a Confirmed bet that never cashed out Loses once the Round is terminal;
//   - a bet still Pending after Betting closed missed the window and is Voided.
export interface BetOutcome {
  isRunning: boolean;
  isConfirmed: boolean;
  isLost: boolean;
  isVoided: boolean;
}

export function deriveBetOutcome({
  status,
  phase,
}: {
  status: BetStatus;
  phase: RoundPhase | null;
}): BetOutcome {
  const isRunning = phase === RoundPhase.RUNNING;
  const isTerminal =
    phase === RoundPhase.CRASHED || phase === RoundPhase.SETTLED;
  const isConfirmed = status === BetStatus.CONFIRMED;
  return {
    isRunning,
    isConfirmed,
    isLost: isConfirmed && isTerminal,
    isVoided:
      status === BetStatus.VOIDED ||
      (status === BetStatus.PENDING && (isRunning || isTerminal)),
  };
}
