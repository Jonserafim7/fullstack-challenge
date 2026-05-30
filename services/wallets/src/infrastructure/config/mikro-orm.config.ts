import { defineConfig } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { WalletSchema } from "../persistence/wallet.schema";
import { Migration00000001Init } from "../migrations/Migration00000001Init";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export default defineConfig({
  clientUrl: requireEnv("DATABASE_URL"),
  entities: [WalletSchema],
  extensions: [Migrator],
  migrations: {
    tableName: "mikro_orm_migrations",
    transactional: true,
    migrationsList: [
      { name: "Migration00000001Init", class: Migration00000001Init },
    ],
  },
  debug: false,
});
