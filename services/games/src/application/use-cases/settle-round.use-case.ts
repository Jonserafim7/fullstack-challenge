import { Injectable, Logger } from "@nestjs/common";
import { BetRepository } from "../repositories/bet.repository";

// No money moves: the stake already left at debit-on-bet; losing only records the miss (ADR-0001).
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
