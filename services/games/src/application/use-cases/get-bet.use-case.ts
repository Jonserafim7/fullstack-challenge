import { Injectable } from "@nestjs/common";
import { BetRepository } from "../repositories/bet.repository";
import { Bet } from "../../domain/entities/bet";

// A bet belonging to another player is returned as null rather than disclosed.
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
