// Builders for the producer-assigned idempotency keys (ADR-0001). Keeping them here means both
// the producer (writing the outbox row) and the consumer (writing the inbox row) derive the
// identical key, so a redelivery deduplicates.

// The debit command's key: wallets dedups on it so a redelivered debit moves money once.
export function debitKey(betId: string): string {
  return `debit:${betId}`;
}

// The confirmation reply's key: games dedups on it so a redelivered reply confirms the Bet once.
export function debitConfirmedKey(betId: string): string {
  return `debit-confirmed:${betId}`;
}

// The payout credit's key: wallets dedups on it so a redelivered payout credits the wallet once
// (ADR-0001 — exactly-once over at-least-once). One payout per cashed-out bet.
export function payoutKey(betId: string): string {
  return `payout:${betId}`;
}

// The rejection reply's key: games dedups on it so a redelivered rejection marks the Bet Rejected
// once. One rejection per refused debit (#7).
export function debitRejectedKey(betId: string): string {
  return `debit-rejected:${betId}`;
}

// The refund credit's key: wallets dedups on it so a redelivered refund credits the wallet once,
// and games' outbox dedups on it so a Voided bet's late confirmation enqueues the refund once
// (ADR-0001). One refund per Voided bet whose debit landed late (#7).
export function refundKey(betId: string): string {
  return `refund:${betId}`;
}
