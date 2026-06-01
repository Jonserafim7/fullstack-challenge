// Producer-side transactional outbox port (ADR-0008). A message is enqueued in the same DB
// transaction as the originating state change; the relay later drains PENDING rows to the broker.
// Mirrors the WalletRepository port — an abstract class so Nest can bind a Prisma adapter to it.

export const OutboxStatus = {
  PENDING: "PENDING",
  PUBLISHED: "PUBLISHED",
  // Terminal: a non-credit row that exhausted its publish attempts. It stops draining and is left
  // visible for inspection instead of lingering as an invisible PENDING. Credits (payout, refund)
  // are never abandoned (ADR-0001), so they never reach FAILED (#7).
  FAILED: "FAILED",
} as const;
export type OutboxStatus = (typeof OutboxStatus)[keyof typeof OutboxStatus];

export interface NewOutboxMessage {
  messageKey: string;
  type: string;
  routingKey: string;
  payload: unknown;
}

export interface PendingOutboxMessage {
  id: string;
  messageKey: string;
  type: string;
  routingKey: string;
  payload: unknown;
  occurredAt: Date;
}

export abstract class OutboxStore {
  abstract enqueue(message: NewOutboxMessage): Promise<void>;
  abstract findPending(args: {
    limit: number;
    maxAttempts: number;
  }): Promise<PendingOutboxMessage[]>;
  abstract markPublished(id: string): Promise<void>;
  // Records a failed publish: increments the attempt count and, once it crosses maxAttempts, parks a
  // non-credit row FAILED so it stops draining. Credits keep retrying forever (ADR-0001).
  abstract markFailed(args: { id: string; maxAttempts: number }): Promise<void>;
}
