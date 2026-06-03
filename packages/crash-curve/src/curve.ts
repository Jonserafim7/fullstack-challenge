// Shared verbatim by the games service and the frontend canvas — single source so the two can never drift (ADR-0003).
export const GROWTH_RATE_PER_SECOND = 0.17;

export function multiplierAt({ elapsedMs }: { elapsedMs: number }): number {
  const elapsedSeconds = elapsedMs / 1000;
  return Math.exp(GROWTH_RATE_PER_SECOND * elapsedSeconds);
}

export function elapsedMsToReach({
  multiplier,
}: {
  multiplier: number;
}): number {
  if (multiplier <= 1) {
    return 0;
  }
  const elapsedSeconds = Math.log(multiplier) / GROWTH_RATE_PER_SECOND;
  return elapsedSeconds * 1000;
}
