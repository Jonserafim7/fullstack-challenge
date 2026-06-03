// The shape every message carries across the games <-> wallets broker. Producers wrap their
// payload in this envelope; consumers read `messageKey` to deduplicate (ADR-0001, ADR-0008).
// Shared so both ends agree on the wire format, exactly as @crash/money shares Money.
export interface MessageEnvelope<TPayload = unknown> {
  // The producer-assigned idempotency key (e.g. `debit:{betId}`). A redelivery carries the same key,
  // letting the consumer's inbox treat it as a no-op.
  messageKey: string;
  // The message type, mirrored by the routing key it is published under.
  type: string;
  payload: TPayload;
  // When the originating state change committed, ISO-8601.
  occurredAt: string;
}
