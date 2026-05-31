import { Module } from "@nestjs/common";
import { GetCurrentRoundUseCase } from "../application/use-cases/get-current-round.use-case";
import { GetRoundHistoryUseCase } from "../application/use-cases/get-round-history.use-case";
import { DatabaseModule } from "../infrastructure/persistence/database.module";
import { HealthController } from "./controllers/health.controller";
import { RoundsController } from "./controllers/rounds.controller";

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, RoundsController],
  providers: [GetCurrentRoundUseCase, GetRoundHistoryUseCase],
})
export class HttpModule {}
