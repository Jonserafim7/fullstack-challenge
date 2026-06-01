import { Bet } from "../../domain/entities/bet";
import { NewOutboxMessage } from "../messaging/outbox-store";

export abstract class BetRepository {
  // Persists a freshly placed Pending Bet and enqueues its debit command in ONE transaction, so a
  // bet never exists without its debit on the way (ADR-0001's no-dual-write guarantee). Throws
  // BetAlreadyPlacedError if the player already has a Bet on that Round.
  abstract place(args: {
    bet: Bet;
    debitMessage: NewOutboxMessage;
  }): Promise<void>;
  abstract findById(betId: string): Promise<Bet | null>;
}
