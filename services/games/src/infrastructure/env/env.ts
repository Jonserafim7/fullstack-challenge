import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(4001),

  RABBITMQ_URL: z.string().url(),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(500),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),
  INBOX_RETRY_BASE_MS: z.coerce.number().int().positive().default(1000),
  INBOX_RETRY_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  KEYCLOAK_ISSUER: z.string().url(),
  KEYCLOAK_JWKS_URI: z.string().url(),

  HOUSE_EDGE: z.coerce.number().min(0).max(1).default(0.01),
  CLIENT_SEED: z.string().default("crash-game"),
  SERVER_TERMINAL_SEED: z.string().optional(),
  SERVER_CHAIN_LENGTH: z.coerce.number().int().positive().default(100_000),

  BETTING_DURATION_MS: z.coerce.number().int().positive().default(5000),
  CRASHED_DISPLAY_MS: z.coerce.number().int().positive().default(3000),

  CRASH_SCENARIO: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
