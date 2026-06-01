import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Request } from "express";
import { EnvService } from "../env/env.service";

export interface AuthenticatedRequest extends Request {
  playerId: string;
  // The Keycloak `preferred_username`, captured so a placed Bet can be broadcast by name. Falls
  // back to the subject if a token somehow omits it.
  username: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwks: JWTVerifyGetKey;
  private readonly issuer: string;

  constructor(env: EnvService) {
    const jwksUri = env.get("KEYCLOAK_JWKS_URI");
    this.issuer = env.get("KEYCLOAK_ISSUER");
    this.jwks = createRemoteJWKSet(new URL(jwksUri));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
      });
      if (!payload.sub) {
        throw new UnauthorizedException("Token has no subject");
      }
      request.playerId = payload.sub;
      request.username =
        (payload.preferred_username as string | undefined) ?? payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length);
}
