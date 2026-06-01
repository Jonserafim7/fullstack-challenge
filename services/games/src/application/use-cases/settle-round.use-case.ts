import { Injectable, Logger } from "@nestjs/common";
import { BetRepository } from "../repositories/bet.repository";

// Settles a crashed Round (ADR-0001): every Bet still Confirmed never cashed out, so it Loses. No
// money moves — the stake already left at debit-on-bet, and a Lost bet is paid nothing. Cashed-out
// bets are already terminal and untouched. Kept as a thin use-case (not inlined in the engine) so
// the timer loop stays free of business logic and a settlement failure can be isolated.
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
