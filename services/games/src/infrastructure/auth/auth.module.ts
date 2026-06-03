import { Module } from "@nestjs/common";
import { EnvModule } from "../env/env.module";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { JwtVerifier } from "./jwt-verifier";

@Module({
  imports: [EnvModule],
  providers: [JwtVerifier, JwtAuthGuard],
  exports: [JwtVerifier, JwtAuthGuard, EnvModule],
})
export class AuthModule {}
