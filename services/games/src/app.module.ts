import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EngineModule } from "./application/engine.module";
import { envSchema } from "./infrastructure/env/env";
import { EnvModule } from "./infrastructure/env/env.module";
import { HttpModule } from "./presentation/http.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: (env) => envSchema.parse(env),
      isGlobal: true,
    }),
    EnvModule,
    HttpModule,
    EngineModule,
  ],
})
export class AppModule {}
