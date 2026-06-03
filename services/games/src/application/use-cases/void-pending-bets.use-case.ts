import { Injectable, Logger } from "@nestjs/common";
import { BetRepository } from "../repositories/bet.repository";

// No money moves: no debit has landed yet; a late debit that arrives afterward triggers a Refund.
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
