import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(4001),

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
