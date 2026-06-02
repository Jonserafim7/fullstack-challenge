import { describe, test, expect } from "bun:test";
import { createHashChain, verifyChainLink } from "../../src/hash-chain";
import { deriveCrashPointHundredths } from "../../src/crash-point";

// A fixed terminal seed makes the whole chain deterministic, so these vectors are pinned:
// recomputing them from the seeds below must always reproduce the same values. They also pin
// the @noble/hashes output to the historical node:crypto output — if the hashing ever diverged,
// these vectors would break.
const TERMINAL_SEED = "a".repeat(64);
const CLIENT_SEED = "crash-game";

const EXPECTED_COMMITMENT =
  "2815168813ea1559e477c2f57d48168627d6369474e26a553d28ec4697e4c5f4";
const EXPECTED_ROUND_1_SEED =
  "0f60da95fe5a978ea1dd5973bef160352ec18428b51525c86ad4d1819738d01f";

describe("hash chain", () => {
  test("publishes a genesis Commitment derived from the terminal seed", () => {
    const chain = createHashChain({ length: 3, terminalSeed: TERMINAL_SEED });

    expect(chain.commitment).toBe(EXPECTED_COMMITMENT);
    expect(chain.length).toBe(3);
  });

  test("uses the terminal seed for the final Round", () => {
    const chain = createHashChain({ length: 3, terminalSeed: TERMINAL_SEED });

    expect(chain.seedForRound(3)).toBe(TERMINAL_SEED);
  });

  test("links every Round's seed back to the Commitment", () => {
    const chain = createHashChain({ length: 3, terminalSeed: TERMINAL_SEED });

    expect(
      verifyChainLink({
        serverSeed: chain.seedForRound(1),
        previousSeed: chain.commitment,
      }),
    ).toBe(true);
    expect(
      verifyChainLink({
        serverSeed: chain.seedForRound(2),
        previousSeed: chain.seedForRound(1),
      }),
    ).toBe(true);
    expect(
      verifyChainLink({
        serverSeed: chain.seedForRound(3),
        previousSeed: chain.seedForRound(2),
      }),
    ).toBe(true);
  });

  test("rejects a forged link", () => {
    const chain = createHashChain({ length: 3, terminalSeed: TERMINAL_SEED });

    expect(
      verifyChainLink({
        serverSeed: chain.seedForRound(2),
        previousSeed: chain.commitment,
      }),
    ).toBe(false);
  });

  test("rejects a Round outside the chain range", () => {
    const chain = createHashChain({ length: 3, terminalSeed: TERMINAL_SEED });

    expect(() => chain.seedForRound(0)).toThrow();
    expect(() => chain.seedForRound(4)).toThrow();
  });

  test("rejects a non-positive chain length", () => {
    expect(() => createHashChain({ length: 0 })).toThrow();
  });
});

describe("crash point", () => {
  test("derives a deterministic Crash Point from known seeds", () => {
    const crashPoint = deriveCrashPointHundredths({
      serverSeed: EXPECTED_ROUND_1_SEED,
      clientSeed: CLIENT_SEED,
    });

    expect(crashPoint).toBe(728);
  });

  test("is stable across repeated derivations", () => {
    const first = deriveCrashPointHundredths({
      serverSeed: EXPECTED_ROUND_1_SEED,
      clientSeed: CLIENT_SEED,
    });
    const second = deriveCrashPointHundredths({
      serverSeed: EXPECTED_ROUND_1_SEED,
      clientSeed: CLIENT_SEED,
    });

    expect(first).toBe(second);
  });

  test("busts instantly at 1.00x for the house-edge fraction of Rounds", () => {
    const crashPoint = deriveCrashPointHundredths({
      serverSeed: EXPECTED_ROUND_1_SEED,
      clientSeed: CLIENT_SEED,
      houseEdge: 1,
    });

    expect(crashPoint).toBe(100);
  });

  test("never returns below 1.00x", () => {
    const chain = createHashChain({ length: 50, terminalSeed: TERMINAL_SEED });

    for (let round = 1; round <= chain.length; round++) {
      const crashPoint = deriveCrashPointHundredths({
        serverSeed: chain.seedForRound(round),
        clientSeed: CLIENT_SEED,
      });

      expect(crashPoint).toBeGreaterThanOrEqual(100);
    }
  });

  test("shifts the outcome when the house edge changes", () => {
    const withDefaultEdge = deriveCrashPointHundredths({
      serverSeed: EXPECTED_ROUND_1_SEED,
      clientSeed: CLIENT_SEED,
    });
    const withoutEdge = deriveCrashPointHundredths({
      serverSeed: EXPECTED_ROUND_1_SEED,
      clientSeed: CLIENT_SEED,
      houseEdge: 0,
    });

    expect(withoutEdge).toBe(735);
    expect(withoutEdge).not.toBe(withDefaultEdge);
  });
});
