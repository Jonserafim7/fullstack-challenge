// The multiplier curve is a pure function of elapsed time, shared verbatim by the games
// service (to time each Crash) and the frontend canvas (to animate the rise). Because both
// sides compute it locally, the growth rate must have a single source of truth — this
// constant — so the two can never drift (ADR-0003).
export const GROWTH_RATE_PER_SECOND = 0.17;

// m(t) = e^(rate * t), with t in seconds. m(0) = 1.00 and the curve is strictly increasing.
export function multiplierAt({ elapsedMs }: { elapsedMs: number }): number {
  const elapsedSeconds = elapsedMs / 1000;
  return Math.exp(GROWTH_RATE_PER_SECOND * elapsedSeconds);
}

// Inverse of m(t): the elapsed time at which the multiplier reaches `multiplier`. The curve
// never dips below its 1.00 starting value, so anything at or below 1.00 is reached at t = 0.
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
