import { createHmac } from "node:crypto";

export const DEFAULT_HOUSE_EDGE = 0.01;

const FIFTY_TWO_BIT_HEX_LENGTH = 13;
const FIFTY_TWO_BIT_DENOMINATOR = 2 ** 52;
const ONE_X_HUNDREDTHS = 100;

// Derives a Round's Crash Point as integer hundredths (ADR-0004): 2.47x is returned as 247,
// an instant bust as 100. Deterministic from the seeds, so anyone holding the revealed
// Server Seed and the public Client Seed can recompute and confirm it (ADR-0002).
//
// h = HMAC_SHA256(key = serverSeed, msg = clientSeed); X = first 52 bits of h; U = X / 2^52.
// A `houseEdge` fraction of Rounds bust instantly at 1.00x; the rest follow the canonical
// 1 / (1 - U) distribution, which makes the return to player exactly (1 - houseEdge).
export function deriveCrashPointHundredths({
  serverSeed,
  clientSeed,
  houseEdge = DEFAULT_HOUSE_EDGE,
}: {
  serverSeed: string;
  clientSeed: string;
  houseEdge?: number;
}): number {
  const hmacHex = createHmac("sha256", serverSeed)
    .update(clientSeed, "utf8")
    .digest("hex");
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
