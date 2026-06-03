import { Injectable } from "@nestjs/common";
import { Bet } from "../../domain/entities/bet";
import { BetRepository } from "../repositories/bet.repository";

@Injectable()
export class GetBetHistoryUseCase {
  constructor(private readonly bets: BetRepository) {}

  async execute({
    playerId,
    page,
    pageSize,
  }: {
    playerId: string;
    page: number;
    pageSize: number;
  }): Promise<{ bets: Bet[]; total: number }> {
    return this.bets.findByPlayer({
      playerId,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  }
}
