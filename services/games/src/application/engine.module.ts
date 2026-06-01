import { Module } from "@nestjs/common";
import { DatabaseModule } from "../infrastructure/persistence/database.module";
import { EnvModule } from "../infrastructure/env/env.module";
import { RealtimeModule } from "../infrastructure/realtime/realtime.module";
import { RoundEngine } from "./round-engine";
import { SettleRoundUseCase } from "./use-cases/settle-round.use-case";

@Module({
  imports: [EnvModule, DatabaseModule, RealtimeModule],
  providers: [RoundEngine, SettleRoundUseCase],
})
export class EngineModule {}
