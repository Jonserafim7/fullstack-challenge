import { InvalidRoundTransitionError } from "../errors/invalid-round-transition.error";

export const RoundPhase = {
  BETTING: "BETTING",
  RUNNING: "RUNNING",
  CRASHED: "CRASHED",
  SETTLED: "SETTLED",
} as const;
export type RoundPhase = (typeof RoundPhase)[keyof typeof RoundPhase];

// State machine Betting -> Running -> Crashed -> Settled; any out-of-order transition throws. Pure
// (no ORM, no timers): the engine owns the clock and persistence, the Round owns only the rules.
export class Round {
  private constructor(
    public readonly roundNumber: number,
    public readonly crashPointHundredths: number,
    public readonly serverSeed: string,
    public readonly clientSeed: string,
    public readonly houseEdge: number,
    public readonly seedHash: string | null,
    private currentPhase: RoundPhase,
    private bettingDeadline: Date | null,
    private runningStartedAt: Date | null,
    private crashedTimestamp: Date | null,
  ) {}

  static open({
    roundNumber,
    crashPointHundredths,
    serverSeed,
    clientSeed,
    houseEdge,
    seedHash,
    bettingEndsAt,
  }: {
    roundNumber: number;
    crashPointHundredths: number;
    serverSeed: string;
    clientSeed: string;
    houseEdge: number;
    seedHash: string;
    bettingEndsAt: Date;
  }): Round {
    return new Round(
      roundNumber,
      crashPointHundredths,
      serverSeed,
      clientSeed,
      houseEdge,
      seedHash,
      RoundPhase.BETTING,
      bettingEndsAt,
      null,
      null,
    );
  }

  static restore({
    roundNumber,
    crashPointHundredths,
    serverSeed,
    clientSeed,
    houseEdge,
    seedHash,
    phase,
    bettingEndsAt,
    startedAt,
    crashedAt,
  }: {
    roundNumber: number;
    crashPointHundredths: number;
    serverSeed: string;
    clientSeed: string;
    houseEdge: number;
    seedHash: string | null;
    phase: RoundPhase;
    bettingEndsAt: Date | null;
    startedAt: Date | null;
    crashedAt: Date | null;
  }): Round {
    return new Round(
      roundNumber,
      crashPointHundredths,
      serverSeed,
      clientSeed,
      houseEdge,
      seedHash,
      phase,
      bettingEndsAt,
      startedAt,
      crashedAt,
    );
  }

  get phase(): RoundPhase {
    return this.currentPhase;
  }

  get bettingEndsAt(): Date | null {
    return this.bettingDeadline;
  }

  get startedAt(): Date | null {
    return this.runningStartedAt;
  }

  get crashedAt(): Date | null {
    return this.crashedTimestamp;
  }

  get isTerminal(): boolean {
    return (
      this.currentPhase === RoundPhase.CRASHED ||
      this.currentPhase === RoundPhase.SETTLED
    );
  }

  startRunning({ startedAt }: { startedAt: Date }): void {
    this.ensureCurrentPhaseIs(RoundPhase.BETTING, RoundPhase.RUNNING);
    this.currentPhase = RoundPhase.RUNNING;
    this.runningStartedAt = startedAt;
  }

  crash({ crashedAt }: { crashedAt: Date }): void {
    this.ensureCurrentPhaseIs(RoundPhase.RUNNING, RoundPhase.CRASHED);
    this.currentPhase = RoundPhase.CRASHED;
    this.crashedTimestamp = crashedAt;
  }

  settle(): void {
    this.ensureCurrentPhaseIs(RoundPhase.CRASHED, RoundPhase.SETTLED);
    this.currentPhase = RoundPhase.SETTLED;
  }

  private ensureCurrentPhaseIs(
    expected: RoundPhase,
    attempted: RoundPhase,
  ): void {
    if (this.currentPhase !== expected) {
      throw new InvalidRoundTransitionError({
        from: this.currentPhase,
        to: attempted,
      });
    }
  }
}
