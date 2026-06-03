import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export const DEFAULT_HOUSE_EDGE = 0.01;

const FIFTY_TWO_BIT_HEX_LENGTH = 13;
const FIFTY_TWO_BIT_DENOMINATOR = 2 ** 52;
const ONE_X_HUNDREDTHS = 100;

// h = HMAC_SHA256(serverSeed, clientSeed); U = first-52-bits / 2^52; houseEdge fraction bust instantly; rest: floor(1/(1-U) * 100) (ADR-0002, ADR-0004).
export function deriveCrashPointHundredths({
  serverSeed,
  clientSeed,
  houseEdge = DEFAULT_HOUSE_EDGE,
}: {
  serverSeed: string;
  clientSeed: string;
  houseEdge?: number;
}): number {
  const hmacHex = bytesToHex(
    hmac(sha256, utf8ToBytes(serverSeed), utf8ToBytes(clientSeed)),
  );
  const fiftyTwoBits = parseInt(hmacHex.slice(0, FIFTY_TWO_BIT_HEX_LENGTH), 16);
  const uniform = fiftyTwoBits / FIFTY_TWO_BIT_DENOMINATOR;

  const isInstantBust = uniform < houseEdge;
  if (isInstantBust) {
    return ONE_X_HUNDREDTHS;
  }

  const nonBustUniform = (uniform - houseEdge) / (1 - houseEdge);
  const rawMultiplier = 1 / (1 - nonBustUniform);
  const hundredths = Math.floor(rawMultiplier * 100);
  return Math.max(ONE_X_HUNDREDTHS, hundredths);
}
