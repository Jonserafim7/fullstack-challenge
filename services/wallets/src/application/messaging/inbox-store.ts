import { NewOutboxMessage } from "./outbox-store";

// Consumer-side idempotent inbox port (ADR-0001, ADR-0008). Recording the inbound message key and
// its effect in ONE transaction makes processing exactly-once: a redelivered key violates the inbox
// primary key, so the whole effect rolls back as a no-op (DuplicateMessageError).
export abstract class InboxStore {
  abstract recordAndEnqueue(args: {
    messageKey: string;
    type: string;
    outbox: NewOutboxMessage[];
  }): Promise<void>;

  // Debits and enqueues confirmReply, or on insufficient funds moves no money and enqueues
  // rejectReply — a committed business outcome, not an error. The delta, dedup key, and reply commit
  // together (ADR-0001). WalletNotFoundError (a genuine anomaly) is left to retry/DLQ.
  abstract recordDebit(args: {
    messageKey: string;
    type: string;
    playerId: string;
    stakeCents: number;
    confirmReply: NewOutboxMessage;
    rejectReply: NewOutboxMessage;
  }): Promise<void>;

  // Credits are unconditional (ADR-0001): no balance guard, no reply, they cannot fail on a business
  // rule, only delay.
  abstract recordCredit(args: {
    messageKey: string;
    type: string;
    playerId: string;
    amountCents: number;
  }): Promise<void>;
}
