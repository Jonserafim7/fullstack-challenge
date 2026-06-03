import { Bet } from "../../domain/entities/bet";
import { NewOutboxMessage } from "./outbox-store";

export interface RefundableBet {
  betId: string;
  playerId: string;
  stakeCents: number;
}

export type ConfirmationResult =
  | { kind: "confirmed"; bet: Bet }
  | { kind: "refunded"; betId: string }
  | { kind: "ignored" };

// Consumer-side idempotent inbox port (ADR-0001, ADR-0008). Recording the inbound message key and
// its effect in ONE transaction makes processing exactly-once: a redelivered key violates the inbox
// primary key, so the whole effect rolls back as a no-op (DuplicateMessageError).
export abstract class InboxStore {
  // A still-Pending Bet becomes Confirmed; a Voided Bet (betting closed before the debit landed)
  // instead enqueues the compensating Refund, in the same transaction as the dedup key.
  abstract recordConfirmation(args: {
    messageKey: string;
    type: string;
    betId: string;
    buildRefund: (bet: RefundableBet) => NewOutboxMessage;
  }): Promise<ConfirmationResult>;

  // Returns the now-Rejected Bet so the caller can notify its owner, or null if the Bet is missing
  // or no longer Pending (already Voided — a rejected debit moved no money, nothing to undo).
  abstract recordRejection(args: {
    messageKey: string;
    type: string;
    betId: string;
  }): Promise<Bet | null>;
}
