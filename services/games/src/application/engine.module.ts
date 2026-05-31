import { Module } from "@nestjs/common";
import { DatabaseModule } from "../infrastructure/persistence/database.module";
import { EnvModule } from "../infrastructure/env/env.module";
import { RoundEngine } from "./round-engine";

@Module({
  imports: [EnvModule, DatabaseModule],
  providers: [RoundEngine],
})
export class EngineModule {}
