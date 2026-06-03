import { Injectable, Logger } from "@nestjs/common";
import { BetRepository } from "../repositories/bet.repository";

// Settles a crashed Round: every still-Confirmed Bet never cashed out, so it Loses. No money moves
// (the stake left at debit-on-bet, ADR-0001). A thin use-case so a settlement failure stays isolated
// from the engine's timer loop.
@Injectable()
export class SettleRoundUseCase {
  private readonly logger = new Logger(SettleRoundUseCase.name);

  constructor(private readonly bets: BetRepository) {}

  async execute({ roundNumber }: { roundNumber: number }): Promise<void> {
    const lost = await this.bets.markConfirmedAsLost({ roundNumber });
    if (lost > 0) {
      this.logger.log(`Round ${roundNumber} settled: ${lost} bet(s) Lost`);
    }
  }
}
