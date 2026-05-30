# Build context is the monorepo root so the shared tsconfig.base.json (which the
# service tsconfig extends) and any @crash/* workspace packages resolve.
FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY packages ./packages
COPY services/games ./services/games

RUN bun install

WORKDIR /app/services/games

EXPOSE 4001

CMD ["bun", "run", "src/main.ts"]
