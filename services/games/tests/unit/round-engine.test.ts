import { describe, test, expect } from "bun:test";
import { RoundEngine } from "../../src/application/round-engine";
import type {
  BettingOpenedEvent,
  CrashedEvent,
  RoundEventPublisher,
  RunningEvent,
} from "../../src/application/realtime/round-event-publisher";
import type { RoundRepository } from "../../src/application/repositories/round.repository";
import type { EnvService } from "../../src/infrastructure/env/env.service";
import { createHashChain } from "../../src/domain/provably-fair";

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
}

function buildEngine(maxRoundNumber: number): {
  engine: RoundEngine;
  captured: Captured;
} {
  const captured: Captured = { bettingOpened: [], running: [], crashed: [] };

  const rounds = {
    save: async () => {},
    findCurrent: async () => null,
    findHistory: async () => ({ rounds: [], total: 0 }),
    maxRoundNumber: async () => maxRoundNumber,
  } as RoundRepository;

  const env = {
    get: (key: keyof typeof envValues) => envValues[key],
  } as unknown as EnvService;

  const publisher: RoundEventPublisher = {
    bettingOpened: (event) => captured.bettingOpened.push(event),
    running: (event) => captured.running.push(event),
    crashed: (event) => captured.crashed.push(event),
  };

  return { engine: new RoundEngine(rounds, env, publisher), captured };
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
