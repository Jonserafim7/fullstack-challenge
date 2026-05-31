# Build context is the monorepo root so the @crash/* workspace packages resolve.
FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY packages ./packages
COPY services/wallets ./services/wallets

# `bun install` runs the wallets postinstall, which generates the Prisma client
# into ./generated/prisma (engine-free query compiler).
RUN bun install

WORKDIR /app/services/wallets

EXPOSE 4002

# Apply pending migrations, then boot. Keeps `docker:up` a single zero-step command.
CMD ["sh", "-c", "bun run db:deploy && bun run src/main.ts"]
