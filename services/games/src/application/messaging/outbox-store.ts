export const OutboxStatus = {
  PENDING: "PENDING",
  PUBLISHED: "PUBLISHED",
  // Credits (payout, refund) are never abandoned — they never reach FAILED (ADR-0001).
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
  // Credits keep retrying forever; only non-credit rows are parked FAILED after maxAttempts (ADR-0001).
  abstract markFailed(args: { id: string; maxAttempts: number }): Promise<void>;
}
