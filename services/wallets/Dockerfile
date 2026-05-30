# Build context is the monorepo root so the @crash/* workspace packages resolve.
FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY packages ./packages
COPY services/wallets ./services/wallets

RUN bun install

WORKDIR /app/services/wallets

EXPOSE 4002

CMD ["bun", "run", "src/main.ts"]
