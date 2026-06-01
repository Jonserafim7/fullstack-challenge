import { Bet } from "../../domain/entities/bet";
import { NewOutboxMessage } from "./outbox-store";

// The minimal Bet data a refund command needs, handed to the factory inside recordConfirmation so
// the producer-side contract logic stays out of the persistence adapter.
export interface RefundableBet {
  betId: string;
  playerId: string;
  stakeCents: number;
}

// What a debit confirmation did, so the use-case can react: a Pending bet was Confirmed (broadcast
// it), a Voided bet's late debit triggered a Refund (compensation enqueued), or there was nothing
// to do (missing bet, or a terminal state that is neither — a no-op).
export type ConfirmationResult =
  | { kind: "confirmed"; bet: Bet }
  | { kind: "refunded"; betId: string }
  | { kind: "ignored" };

// Consumer-side idempotent inbox port (ADR-0001, ADR-0008). Recording the inbound message key and
// its effect in ONE transaction makes processing exactly-once: a redelivered key violates the
// inbox primary key, so the whole effect rolls back as a no-op. Added on the games side in #14 to
// confirm bets from the wallets debit replies; #7 adds the rejection and the void-refund branch.
export abstract class InboxStore {
  // Records the inbound message key and applies the debit confirmation atomically. A still-Pending
  // Bet becomes Confirmed; a Voided Bet (its betting window closed before the debit landed) instead
  // enqueues the compensating Refund built by `buildRefund`, in the same transaction as the dedup
  // key (the refund's own key makes a redelivery a no-op). Throws DuplicateMessageError if the key
  // was already recorded (a redelivery — nothing applied).
  abstract recordConfirmation(args: {
    messageKey: string;
    type: string;
    betId: string;
    buildRefund: (bet: RefundableBet) => NewOutboxMessage;
  }): Promise<ConfirmationResult>;

  // Records the inbound message key and marks the Bet Rejected atomically. Returns the now-Rejected
  // Bet so the caller can notify its owner, or null if the Bet is missing or no longer Pending (e.g.
  // already Voided — a rejected debit moved no money, so there is nothing to undo). Throws
  // DuplicateMessageError if the key was already recorded (a redelivery — nothing applied).
  abstract recordRejection(args: {
    messageKey: string;
    type: string;
    betId: string;
  }): Promise<Bet | null>;
}
