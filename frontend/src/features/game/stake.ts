export const MIN_STAKE_CENTS = 100;
export const MAX_STAKE_CENTS = 100_000;

export function reaisToCents(value: string): number | null {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  if (normalized === "") return null;
  const reais = Number(normalized);
  if (!Number.isFinite(reais)) return null;
  return Math.round(reais * 100);
}

export function isStakeWithinBounds(cents: number | null): cents is number {
  return cents !== null && cents >= MIN_STAKE_CENTS && cents <= MAX_STAKE_CENTS;
}
