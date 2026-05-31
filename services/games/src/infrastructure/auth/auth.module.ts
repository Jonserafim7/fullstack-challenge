import { Module } from "@nestjs/common";
import { EnvModule } from "../env/env.module";
import { JwtVerifier } from "./jwt-verifier";

@Module({
  imports: [EnvModule],
  providers: [JwtVerifier],
  exports: [JwtVerifier],
})
export class AuthModule {}
