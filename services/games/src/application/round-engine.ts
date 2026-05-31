import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { elapsedMsToReach } from "@crash/crash-curve";
import { Round, RoundPhase } from "../domain/entities/round";
import {
  createHashChain,
  deriveCrashPointHundredths,
  type HashChain,
} from "../domain/provably-fair";
import { EnvService } from "../infrastructure/env/env.service";
import { RoundEventPublisher } from "./realtime/round-event-publisher";
import { RoundRepository } from "./repositories/round.repository";

const ONE_X_HUNDREDTHS = 100;

// Drives the continuous Round lifecycle on a timer. Each Round's Crash Point is fixed up
// front from the provably-fair chain; the Running phase lasts exactly as long as the shared
// curve takes to reach that Crash Point. A self-rescheduling chain of timeouts (not an
// interval, since every phase has a different length) advances the state machine and
// persists each transition. Server -> client push and the canvas come in later slices.
@Injectable()
export class RoundEngine implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RoundEngine.name);
  private chain!: HashChain;
  private nextRoundNumber = 1;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private readonly rounds: RoundRepository,
    private readonly env: EnvService,
    private readonly publisher: RoundEventPublisher,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.chain = createHashChain({
      length: this.env.get("SERVER_CHAIN_LENGTH"),
      terminalSeed: this.env.get("SERVER_TERMINAL_SEED") || undefined,
    });
    await this.settleDanglingRound();
    this.nextRoundNumber = (await this.rounds.maxRoundNumber()) + 1;
    void this.openNextRound();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
    }
  }

  // A previous process may have died mid-Round; force that Round to a terminal state so the
  // numbering stays clean and it does not masquerade as the current Round forever.
  private async settleDanglingRound(): Promise<void> {
    const current = await this.rounds.findCurrent();
    if (!current || current.isTerminal) {
      return;
    }
    const now = new Date();
    if (current.phase === RoundPhase.BETTING) {
      current.startRunning({ startedAt: now });
    }
    if (current.phase === RoundPhase.RUNNING) {
      current.crash({ crashedAt: now });
    }
    current.settle();
    await this.rounds.save(current);
  }

  private async openNextRound(): Promise<void> {
    if (this.stopped) {
      return;
    }
    const roundNumber = this.nextRoundNumber;
    if (roundNumber > this.chain.length) {
      this.logger.error(
        `Hash chain exhausted at round ${roundNumber}; stopping engine.`,
      );
      return;
    }

    const serverSeed = this.chain.seedForRound(roundNumber);
    const clientSeed = this.env.get("CLIENT_SEED");
    const houseEdge = this.env.get("HOUSE_EDGE");
    const bettingDurationMs = this.env.get("BETTING_DURATION_MS");
    const round = Round.open({
      roundNumber,
      crashPointHundredths: deriveCrashPointHundredths({
        serverSeed,
        clientSeed,
        houseEdge,
      }),
      serverSeed,
      clientSeed,
      houseEdge,
      bettingEndsAt: new Date(Date.now() + bettingDurationMs),
    });

    await this.rounds.save(round);
    this.publisher.bettingOpened({
      roundNumber: round.roundNumber,
      seedHash: this.seedHashFor(round.roundNumber),
      bettingEndsAt: round.bettingEndsAt!.toISOString(),
    });
    this.scheduleAfter(bettingDurationMs, () => this.startRunning(round));
  }

  private async startRunning(round: Round): Promise<void> {
    round.startRunning({ startedAt: new Date() });
    await this.rounds.save(round);
    this.publisher.running({
      roundNumber: round.roundNumber,
      startedAt: round.startedAt!.toISOString(),
    });
    const runningMs = elapsedMsToReach({
      multiplier: round.crashPointHundredths / ONE_X_HUNDREDTHS,
    });
    this.scheduleAfter(runningMs, () => this.crash(round));
  }

  private async crash(round: Round): Promise<void> {
    round.crash({ crashedAt: new Date() });
    await this.rounds.save(round);
    this.publisher.crashed({
      roundNumber: round.roundNumber,
      crashPoint: round.crashPointHundredths,
      crashedAt: round.crashedAt!.toISOString(),
      verification: {
        serverSeed: round.serverSeed,
        previousSeed: this.seedHashFor(round.roundNumber),
        clientSeed: round.clientSeed,
        houseEdge: round.houseEdge,
      },
    });
    this.scheduleAfter(this.env.get("CRASHED_DISPLAY_MS"), () =>
      this.settleAndContinue(round),
    );
  }

  // The commitment a client checks a revealed Server Seed against: the previous Round's seed,
  // or the genesis Commitment for Round 1 (seedForRound rejects round 0).
  private seedHashFor(roundNumber: number): string {
    return roundNumber === 1
      ? this.chain.commitment
      : this.chain.seedForRound(roundNumber - 1);
  }

  private async settleAndContinue(round: Round): Promise<void> {
    round.settle();
    await this.rounds.save(round);
    this.nextRoundNumber += 1;
    void this.openNextRound();
  }

  private scheduleAfter(delayMs: number, step: () => Promise<void>): void {
    if (this.stopped) {
      return;
    }
    this.pendingTimer = setTimeout(
      () => {
        void step().catch((error) => {
          this.logger.error("Round engine step failed", error as Error);
        });
      },
      Math.max(0, Math.ceil(delayMs)),
    );
  }
}
