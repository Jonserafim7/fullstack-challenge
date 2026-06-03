import { Bet } from "../../domain/entities/bet";
import { NewOutboxMessage } from "../messaging/outbox-store";

export abstract class BetRepository {
  // Bet + debit command persisted in ONE transaction (no dual write).
  abstract place(args: {
    bet: Bet;
    debitMessage: NewOutboxMessage;
  }): Promise<void>;
  abstract findById(betId: string): Promise<Bet | null>;

  abstract findByRoundAndPlayer(args: {
    roundNumber: number;
    playerId: string;
  }): Promise<Bet | null>;

  abstract findByPlayer(args: {
    playerId: string;
    limit: number;
    offset: number;
  }): Promise<{ bets: Bet[]; total: number }>;

  // Cashed-out transition + payout credit in ONE transaction (no dual write).
  abstract cashOut(args: {
    bet: Bet;
    payoutMessage: NewOutboxMessage;
  }): Promise<void>;

  // No money moves: stake already left at debit-on-bet.
  abstract markConfirmedAsLost(args: { roundNumber: number }): Promise<number>;

  // No money moves: no debit has landed yet; a late debit that arrives afterward triggers a Refund.
  abstract markPendingAsVoided(args: { roundNumber: number }): Promise<number>;
}
