import { Module } from "@nestjs/common";
import { EnvModule } from "../env/env.module";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Module({
  imports: [EnvModule],
  providers: [JwtAuthGuard],
  exports: [JwtAuthGuard, EnvModule],
})
export class AuthModule {}
