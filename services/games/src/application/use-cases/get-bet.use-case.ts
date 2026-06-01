import { Injectable } from "@nestjs/common";
import { BetRepository } from "../repositories/bet.repository";
import { Bet } from "../../domain/entities/bet";

// Reads one Bet for its owner. A player sees only their own bets, so a bet that belongs to someone
// else is reported as absent (null) rather than disclosed. Lets a client reconcile a Pending bet
// over REST if it missed the `bet.confirmed` WebSocket event.
@Injectable()
export class GetBetUseCase {
  constructor(private readonly bets: BetRepository) {}

  async execute({
    betId,
    playerId,
  }: {
    betId: string;
    playerId: string;
  }): Promise<Bet | null> {
    const bet = await this.bets.findById(betId);
    if (!bet || bet.playerId !== playerId) {
      return null;
    }
    return bet;
  }
}
