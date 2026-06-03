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

export abstract class InboxStore {
  // Message key + effect recorded in ONE transaction: a redelivered key rolls the whole effect back as a no-op.
  abstract recordConfirmation(args: {
    messageKey: string;
    type: string;
    betId: string;
    buildRefund: (bet: RefundableBet) => NewOutboxMessage;
  }): Promise<ConfirmationResult>;

  // Returns null if already Voided: a rejected debit moved no money, so there is nothing to undo.
  abstract recordRejection(args: {
    messageKey: string;
    type: string;
    betId: string;
  }): Promise<Bet | null>;
}
