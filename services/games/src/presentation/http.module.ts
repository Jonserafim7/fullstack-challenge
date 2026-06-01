import { Module } from "@nestjs/common";
import { EnqueueSmokePingUseCase } from "../application/use-cases/enqueue-smoke-ping.use-case";
import { GetCurrentRoundUseCase } from "../application/use-cases/get-current-round.use-case";
import { GetRoundHistoryUseCase } from "../application/use-cases/get-round-history.use-case";
import { DatabaseModule } from "../infrastructure/persistence/database.module";
import { HealthController } from "./controllers/health.controller";
import { RoundsController } from "./controllers/rounds.controller";
import { SmokeController } from "./controllers/smoke.controller";

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, RoundsController, SmokeController],
  providers: [
    GetCurrentRoundUseCase,
    GetRoundHistoryUseCase,
    EnqueueSmokePingUseCase,
  ],
})
export class HttpModule {}
