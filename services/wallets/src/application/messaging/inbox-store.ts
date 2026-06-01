import { NewOutboxMessage } from "./outbox-store";

// Consumer-side idempotent inbox port (ADR-0001, ADR-0008). Recording the inbound message key
// and the resulting effect in ONE transaction makes processing exactly-once: a redelivered key
// violates the inbox primary key, so the whole effect rolls back as a no-op.
export abstract class InboxStore {
  // Records the inbound message key and enqueues the given outbox messages atomically.
  // Throws DuplicateMessageError if the key was already recorded (a redelivery — nothing applied).
  abstract recordAndEnqueue(args: {
    messageKey: string;
    type: string;
    outbox: NewOutboxMessage[];
  }): Promise<void>;

  // Records the inbound message key, debits the player's wallet, and enqueues the reply — all in
  // one transaction, so the balance delta and the dedup key commit together (the exactly-once
  // money guarantee of ADR-0001). Throws DuplicateMessageError on a redelivery (nothing applied),
  // WalletNotFoundError if the player has no wallet, InsufficientBalanceError if funds fall short.
  abstract recordDebit(args: {
    messageKey: string;
    type: string;
    playerId: string;
    stakeCents: number;
    reply: NewOutboxMessage;
  }): Promise<void>;
}
