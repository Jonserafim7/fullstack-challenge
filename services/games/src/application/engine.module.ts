import { Module } from "@nestjs/common";
import { DatabaseModule } from "../infrastructure/persistence/database.module";
import { EnvModule } from "../infrastructure/env/env.module";
import { RealtimeModule } from "../infrastructure/realtime/realtime.module";
import { RoundEngine } from "./round-engine";

@Module({
  imports: [EnvModule, DatabaseModule, RealtimeModule],
  providers: [RoundEngine],
})
export class EngineModule {}
