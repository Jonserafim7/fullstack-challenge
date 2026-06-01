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

  // Records the inbound message key, attempts to debit the player's wallet, and enqueues exactly one
  // reply — all in one transaction, so the balance delta (if any), the dedup key, and the reply
  // commit together (the exactly-once money guarantee of ADR-0001). On sufficient funds it debits
  // and enqueues `confirmReply`; on insufficient funds it moves no money and enqueues `rejectReply`
  // — insufficient funds is a committed business outcome, not an error (#7). Throws
  // DuplicateMessageError on a redelivery (nothing applied), WalletNotFoundError if the player has
  // no wallet (a genuine anomaly, left to retry/DLQ).
  abstract recordDebit(args: {
    messageKey: string;
    type: string;
    playerId: string;
    stakeCents: number;
    confirmReply: NewOutboxMessage;
    rejectReply: NewOutboxMessage;
  }): Promise<void>;

  // Records the inbound message key and credits the player's wallet in one transaction. Credits are
  // unconditional (ADR-0001) — no balance guard, no reply, they cannot fail on a business rule, only
  // delay. Throws DuplicateMessageError on a redelivery (nothing applied), WalletNotFoundError if the
  // player has no wallet.
  abstract recordCredit(args: {
    messageKey: string;
    type: string;
    playerId: string;
    amountCents: number;
  }): Promise<void>;
}
