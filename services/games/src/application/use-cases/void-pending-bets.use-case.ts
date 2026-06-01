import { Injectable, Logger } from "@nestjs/common";
import { BetRepository } from "../repositories/bet.repository";

// Voids every Bet still Pending when a Round leaves Betting (ADR-0001): the betting window is the
// debit deadline, so a Pending bet at round start never participated. No money moves here — if the
// bet's debit lands afterward, the late confirmation issues a compensating Refund. Kept as a thin
// use-case (not inlined in the engine) so the timer loop stays free of business logic and a void
// failure can be isolated, mirroring SettleRoundUseCase.
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
