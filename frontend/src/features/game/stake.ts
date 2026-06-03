// Stake parsing and the bounds the bet form enforces. The bounds mirror the games service's
// MIN/MAX (R$1,00–R$1.000,00 as integer cents, ADR-0004) so the button disables before a request the
// API would reject anyway. Kept as pure functions so the form and its tests share one source of truth.
export const MIN_STAKE_CENTS = 100;
export const MAX_STAKE_CENTS = 100_000;

// pt-BR currency text -> integer cents. Strips thousands dots, treats the comma as the decimal.
// Returns null for empty or non-numeric input.
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
