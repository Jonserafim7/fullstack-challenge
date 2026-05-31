import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./infrastructure/auth/auth.module";
import { DatabaseModule } from "./infrastructure/persistence/database.module";
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
    DatabaseModule,
    AuthModule,
    HttpModule,
  ],
})
export class AppModule {}
