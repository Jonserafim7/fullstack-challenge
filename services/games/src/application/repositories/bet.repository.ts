import { Bet } from "../../domain/entities/bet";
import { NewOutboxMessage } from "../messaging/outbox-store";

export abstract class BetRepository {
  // Persists the Pending Bet and its debit command in ONE transaction (ADR-0001, no dual write).
  // Throws BetAlreadyPlacedError if the player already has a Bet on that Round.
  abstract place(args: {
    bet: Bet;
    debitMessage: NewOutboxMessage;
  }): Promise<void>;
  abstract findById(betId: string): Promise<Bet | null>;

  // The caller's bet on a given Round, used to cash out (a player has at most one bet per Round).
  abstract findByRoundAndPlayer(args: {
    roundNumber: number;
    playerId: string;
  }): Promise<Bet | null>;

  // A page of the player's own Bets, newest first, with the total count for pagination.
  abstract findByPlayer(args: {
    playerId: string;
    limit: number;
    offset: number;
  }): Promise<{ bets: Bet[]; total: number }>;

  // Persists the Cashed Out transition and its payout credit in ONE transaction (ADR-0001).
  abstract cashOut(args: {
    bet: Bet;
    payoutMessage: NewOutboxMessage;
  }): Promise<void>;

  // Settlement: every still-Confirmed bet on the Round crashed without cashing out, so it Loses. No
  // money moves (debit-on-bet). Returns how many bets were marked. A single batched UPDATE.
  abstract markConfirmedAsLost(args: { roundNumber: number }): Promise<number>;

  // Round start: every still-Pending bet missed the betting window, so it is Voided. No money moves
  // (a late debit is compensated by a Refund). Returns how many bets were marked. A batched UPDATE.
  abstract markPendingAsVoided(args: { roundNumber: number }): Promise<number>;
}
