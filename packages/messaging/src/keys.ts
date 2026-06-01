// Builders for the producer-assigned idempotency keys (ADR-0001). Keeping them here means both
// the producer (writing the outbox row) and the consumer (writing the inbox row) derive the
// identical key, so a redelivery deduplicates. #14 adds the debit pair; payout/refund follow.

export function smokePingKey(correlationId: string): string {
  return `smoke:${correlationId}`;
}

export function smokePongKey(correlationId: string): string {
  return `smoke-pong:${correlationId}`;
}

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
