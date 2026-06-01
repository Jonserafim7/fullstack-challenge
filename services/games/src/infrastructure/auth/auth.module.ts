import { Module } from "@nestjs/common";
import { EnvModule } from "../env/env.module";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { JwtVerifier } from "./jwt-verifier";

// JwtVerifier guards the WebSocket handshake (ADR-0003); JwtAuthGuard guards the REST routes that
// place and read bets (#14). Both validate the same Keycloak-issued token against the realm JWKS.
@Module({
  imports: [EnvModule],
  providers: [JwtVerifier, JwtAuthGuard],
  exports: [JwtVerifier, JwtAuthGuard],
})
export class AuthModule {}
