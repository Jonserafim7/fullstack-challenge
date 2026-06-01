// Builders for the producer-assigned idempotency keys (ADR-0001). Keeping them here means both
// the producer (writing the outbox row) and the consumer (writing the inbox row) derive the
// identical key, so a redelivery deduplicates. #14 adds `debit:`/`payout:`/`refund:` builders.

export function smokePingKey(correlationId: string): string {
  return `smoke:${correlationId}`;
}

export function smokePongKey(correlationId: string): string {
  return `smoke-pong:${correlationId}`;
}
