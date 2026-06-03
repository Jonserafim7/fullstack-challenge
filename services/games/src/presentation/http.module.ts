import { Module } from "@nestjs/common";
import { CashOutBetUseCase } from "../application/use-cases/cash-out-bet.use-case";
import { GetBetUseCase } from "../application/use-cases/get-bet.use-case";
import { GetBetHistoryUseCase } from "../application/use-cases/get-bet-history.use-case";
import { GetCurrentRoundUseCase } from "../application/use-cases/get-current-round.use-case";
import { GetRoundHistoryUseCase } from "../application/use-cases/get-round-history.use-case";
import { GetRoundVerificationUseCase } from "../application/use-cases/get-round-verification.use-case";
import { PlaceBetUseCase } from "../application/use-cases/place-bet.use-case";
import { AuthModule } from "../infrastructure/auth/auth.module";
import { DatabaseModule } from "../infrastructure/persistence/database.module";
import { RealtimeModule } from "../infrastructure/realtime/realtime.module";
import { BetsController } from "./controllers/bets.controller";
import { HealthController } from "./controllers/health.controller";
import { RoundsController } from "./controllers/rounds.controller";

@Module({
  imports: [DatabaseModule, AuthModule, RealtimeModule],
  controllers: [HealthController, RoundsController, BetsController],
  providers: [
    GetCurrentRoundUseCase,
    GetRoundHistoryUseCase,
    GetRoundVerificationUseCase,
    PlaceBetUseCase,
    CashOutBetUseCase,
    GetBetUseCase,
    GetBetHistoryUseCase,
  ],
})
export class HttpModule {}
