import { Injectable, Logger } from "@nestjs/common";
import { BetRepository } from "../repositories/bet.repository";

// Voids every Bet still Pending when a Round leaves Betting (ADR-0001): the betting window is the
// debit deadline. No money moves; a debit that lands afterward is compensated by a Refund.
@Injectable()
export class VoidPendingBetsUseCase {
  private readonly logger = new Logger(VoidPendingBetsUseCase.name);

  constructor(private readonly bets: BetRepository) {}

  async execute({ roundNumber }: { roundNumber: number }): Promise<void> {
    const voided = await this.bets.markPendingAsVoided({ roundNumber });
    if (voided > 0) {
      this.logger.log(`Round ${roundNumber}: ${voided} pending bet(s) Voided`);
    }
  }
}
