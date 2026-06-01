import { Bet } from "../../domain/entities/bet";

// Consumer-side idempotent inbox port (ADR-0001, ADR-0008). Recording the inbound message key and
// its effect in ONE transaction makes processing exactly-once: a redelivered key violates the
// inbox primary key, so the whole effect rolls back as a no-op. Added on the games side in #14 to
// confirm bets from the wallets debit replies (the money side dedups commands; games dedups replies).
export abstract class InboxStore {
  // Records the inbound message key and marks the Bet Confirmed atomically. Returns the now-Confirmed
  // Bet so the caller can broadcast it, or null if the Bet is missing or no longer Pending. Throws
  // DuplicateMessageError if the key was already recorded (a redelivery — nothing applied).
  abstract recordConfirmation(args: {
    messageKey: string;
    type: string;
    betId: string;
  }): Promise<Bet | null>;
}
