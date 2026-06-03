import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { EnvService } from "../env/env.service";

@Injectable()
export class JwtVerifier {
  private readonly jwks: JWTVerifyGetKey;
  private readonly issuer: string;

  constructor(env: EnvService) {
    this.issuer = env.get("KEYCLOAK_ISSUER");
    this.jwks = createRemoteJWKSet(new URL(env.get("KEYCLOAK_JWKS_URI")));
  }

  async verify(token: string): Promise<string> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
      });
      if (!payload.sub) {
        throw new UnauthorizedException("Token has no subject");
      }
      return payload.sub;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}
