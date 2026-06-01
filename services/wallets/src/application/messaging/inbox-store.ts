import { NewOutboxMessage } from "./outbox-store";

// Consumer-side idempotent inbox port (ADR-0001, ADR-0008). Recording the inbound message key
// and the resulting outbox messages in ONE transaction makes processing exactly-once: a
// redelivered key violates the inbox primary key, so the whole effect rolls back as a no-op.
export abstract class InboxStore {
  // Records the inbound message key and enqueues the given outbox messages atomically.
  // Throws DuplicateMessageError if the key was already recorded (a redelivery — nothing applied).
  abstract recordAndEnqueue(args: {
    messageKey: string;
    type: string;
    outbox: NewOutboxMessage[];
  }): Promise<void>;
}
