import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(4001),

  // Async games<->wallets integration over RabbitMQ (ADR-0001, ADR-0008). The relay drains the
  // outbox on this interval; a message that fails to publish that many times is left for inspection.
  RABBITMQ_URL: z.string().url(),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(500),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),

  // Auth: validate the token issuer, fetch signing keys from the IdP. The games
  // WebSocket gateway validates the JWT on connect (ADR-0003).
  KEYCLOAK_ISSUER: z.string().url(),
  KEYCLOAK_JWKS_URI: z.string().url(),

  // Provably-fair engine (ADR-0002).
  HOUSE_EDGE: z.coerce.number().min(0).max(1).default(0.01),
  CLIENT_SEED: z.string().default("crash-game"),
  // A fixed terminal seed makes the Commitment and the Crash Point sequence
  // reproducible across restarts; left unset, a random chain is generated.
  SERVER_TERMINAL_SEED: z.string().optional(),
  SERVER_CHAIN_LENGTH: z.coerce.number().int().positive().default(100_000),

  // Round timing (milliseconds). Running length always varies with the Crash Point.
  BETTING_DURATION_MS: z.coerce.number().int().positive().default(5000),
  CRASHED_DISPLAY_MS: z.coerce.number().int().positive().default(3000),
});

export type Env = z.infer<typeof envSchema>;
