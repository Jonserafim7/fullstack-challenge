import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().url(),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(500),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),
  INBOX_RETRY_BASE_MS: z.coerce.number().int().positive().default(1000),
  INBOX_RETRY_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  KEYCLOAK_ISSUER: z.string().url(),
  KEYCLOAK_JWKS_URI: z.string().url(),
  TEST_PLAYER_ID: z.string().uuid().optional(),
  TEST_PLAYER_ID_2: z.string().uuid().optional(),
  WALLET_STARTING_BALANCE_CENTS: z
    .string()
    .regex(/^\d+$/)
    .default("100000")
    .transform((value) => BigInt(value)),
  PORT: z.coerce.number().int().positive().default(4002),
});

export type Env = z.infer<typeof envSchema>;
