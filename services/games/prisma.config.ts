import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` runs at image build time, before DATABASE_URL exists, so the
// URL is read leniently here (empty when unset). It is only actually needed by
// `prisma migrate`, which runs at container start with the env populated.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
