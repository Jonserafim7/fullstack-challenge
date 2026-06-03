import { describe, test, expect } from "bun:test";
import { RoundEngine } from "../../src/application/round-engine";
import type {
  BettingOpenedEvent,
  CrashedEvent,
  RoundEventPublisher,
  RunningEvent,
} from "../../src/application/realtime/round-event-publisher";
import type { RoundRepository } from "../../src/application/repositories/round.repository";
import type { SettleRoundUseCase } from "../../src/application/use-cases/settle-round.use-case";
import type { VoidPendingBetsUseCase } from "../../src/application/use-cases/void-pending-bets.use-case";
import type { EnvService } from "../../src/infrastructure/env/env.service";
import type { Round } from "../../src/domain/entities/round";
import {
  createHashChain,
  deriveCrashPointHundredths,
} from "@crash/provably-fair";

const TERMINAL_SEED = "a".repeat(64);
const CHAIN_LENGTH = 10;

// Betting/Crashed delays are pushed far out so the engine's self-rescheduling timer never
// fires during the test — we only exercise the synchronous open-Round emission.
const envValues = {
  SERVER_CHAIN_LENGTH: CHAIN_LENGTH,
  SERVER_TERMINAL_SEED: TERMINAL_SEED,
  CLIENT_SEED: "crash-game",
  HOUSE_EDGE: 0.01,
  BETTING_DURATION_MS: 3_600_000,
  CRASHED_DISPLAY_MS: 3_600_000,
} as const;

interface Captured {
  bettingOpened: BettingOpenedEvent[];
  running: RunningEvent[];
  crashed: CrashedEvent[];
  saved: Round[];
}

function buildEngine(
  maxRoundNumber: number,
  envOverride: Record<string, unknown> = {},
): {
  engine: RoundEngine;
  captured: Captured;
} {
  const captured: Captured = {
    bettingOpened: [],
    running: [],
    crashed: [],
    saved: [],
  };

  const rounds = {
    save: async (round: Round) => {
      captured.saved.push(round);
    },
    findCurrent: async () => null,
    findByNumber: async () => null,
    findHistory: async () => ({ rounds: [], total: 0 }),
    maxRoundNumber: async () => maxRoundNumber,
  } as RoundRepository;

  const env = {
    get: (key: string) =>
      key in envOverride
        ? envOverride[key]
        : (envValues as Record<string, unknown>)[key],
  } as unknown as EnvService;

  const publisher: RoundEventPublisher = {
    bettingOpened: (event) => captured.bettingOpened.push(event),
    running: (event) => captured.running.push(event),
    crashed: (event) => captured.crashed.push(event),
    // The engine never confirms, cashes out, or rejects bets; no-ops keep the fake satisfying the port.
    betConfirmed: () => {},
    betCashedOut: () => {},
    betRejected: () => {},
  };

  const settleRound = {
    execute: async () => {},
  } as unknown as SettleRoundUseCase;

  const voidPendingBets = {
    execute: async () => {},
  } as unknown as VoidPendingBetsUseCase;

  return {
    engine: new RoundEngine(
      rounds,
      env,
      publisher,
      settleRound,
      voidPendingBets,
    ),
    captured,
  };
}

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("RoundEngine realtime emissions", () => {
  test("emits round.betting_opened with the genesis Commitment as seedHash for Round 1", async () => {
    const { engine, captured } = buildEngine(0);

    await engine.onApplicationBootstrap();
    await flushMicrotasks();
    engine.onModuleDestroy();

    const expectedChain = createHashChain({
      length: CHAIN_LENGTH,
      terminalSeed: TERMINAL_SEED,
    });
    expect(captured.bettingOpened).toHaveLength(1);
    expect(captured.bettingOpened[0].roundNumber).toBe(1);
    expect(captured.bettingOpened[0].seedHash).toBe(expectedChain.commitment);
    expect(typeof captured.bettingOpened[0].bettingEndsAt).toBe("string");
  });

  test("emits the previous Round's seed as seedHash for a later Round", async () => {
    const { engine, captured } = buildEngine(5);

    await engine.onApplicationBootstrap();
    await flushMicrotasks();
    engine.onModuleDestroy();

    const expectedChain = createHashChain({
      length: CHAIN_LENGTH,
      terminalSeed: TERMINAL_SEED,
    });
    expect(captured.bettingOpened).toHaveLength(1);
    expect(captured.bettingOpened[0].roundNumber).toBe(6);
    expect(captured.bettingOpened[0].seedHash).toBe(
      expectedChain.seedForRound(5),
    );
  });
});

describe("RoundEngine Crash Point source", () => {
  test("derives the Crash Point from the provably-fair chain when no scenario is set", async () => {
    const { engine, captured } = buildEngine(0);

    await engine.onApplicationBootstrap();
    await flushMicrotasks();
    engine.onModuleDestroy();

    const chain = createHashChain({
      length: CHAIN_LENGTH,
      terminalSeed: TERMINAL_SEED,
    });
    const expected = deriveCrashPointHundredths({
      serverSeed: chain.seedForRound(1),
      clientSeed: envValues.CLIENT_SEED,
      houseEdge: envValues.HOUSE_EDGE,
    });
    expect(captured.saved[0].crashPointHundredths).toBe(expected);
  });

  test("uses the scripted CRASH_SCENARIO sequence when set", async () => {
    const round1 = buildEngine(0, { CRASH_SCENARIO: "300,500" });
    await round1.engine.onApplicationBootstrap();
    await flushMicrotasks();
    round1.engine.onModuleDestroy();
    expect(round1.captured.saved[0].crashPointHundredths).toBe(300);

    // Round 2 cycles to the next scenario entry.
    const round2 = buildEngine(1, { CRASH_SCENARIO: "300,500" });
    await round2.engine.onApplicationBootstrap();
    await flushMicrotasks();
    round2.engine.onModuleDestroy();
    expect(round2.captured.saved[0].crashPointHundredths).toBe(500);
  });
});
