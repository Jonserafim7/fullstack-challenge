import { BetStatus, RoundPhase } from "./round-contracts";

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
