// Producer-side transactional outbox port (ADR-0008). A message is enqueued in the same DB
// transaction as the originating state change; the relay later drains PENDING rows to the broker.
// Mirrors the RoundRepository port — an abstract class so Nest can bind a Prisma adapter to it.

export const OutboxStatus = {
  PENDING: "PENDING",
  PUBLISHED: "PUBLISHED",
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
  abstract markFailed(id: string): Promise<void>;
}
