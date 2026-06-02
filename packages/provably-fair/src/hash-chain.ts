import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, randomBytes, utf8ToBytes } from "@noble/hashes/utils.js";

export const DEFAULT_CHAIN_LENGTH = 100_000;

export interface HashChain {
  readonly commitment: string;
  readonly length: number;
  seedForRound(round: number): string;
}

function sha256Hex(value: string): string {
  return bytesToHex(sha256(utf8ToBytes(value)));
}

// Pre-generates a server-seed chain backward from a random terminal seed:
//   chain[i - 1] = SHA256(chain[i])
// chain[0] is the genesis Commitment, published before any Round runs; Round r uses
// chain[r]. Revealing chain[r] after a Round lets anyone check SHA256(chain[r]) == chain[r-1]
// and walk the links back to the Commitment, so every future Crash Point is locked in
// advance (ADR-0002).
export function createHashChain(options?: {
  length?: number;
  terminalSeed?: string;
}): HashChain {
  const length = options?.length ?? DEFAULT_CHAIN_LENGTH;
  if (length < 1) {
    throw new RangeError(`Hash chain length must be at least 1: ${length}`);
  }

  const seeds = new Array<string>(length + 1);
  seeds[length] = options?.terminalSeed ?? bytesToHex(randomBytes(32));
  for (let round = length; round > 0; round--) {
    seeds[round - 1] = sha256Hex(seeds[round]);
  }

  return {
    commitment: seeds[0],
    length,
    seedForRound(round: number): string {
      const isOutsideRange = round < 1 || round > length;
      if (isOutsideRange) {
        throw new RangeError(
          `Round ${round} is outside the chain range 1..${length}`,
        );
      }
      return seeds[round];
    },
  };
}

// The chain link a verifier checks: hashing a revealed Server Seed yields the previous
// Round's seed, or the genesis Commitment for Round 1.
export function verifyChainLink({
  serverSeed,
  previousSeed,
}: {
  serverSeed: string;
  previousSeed: string;
}): boolean {
  return sha256Hex(serverSeed) === previousSeed;
}
