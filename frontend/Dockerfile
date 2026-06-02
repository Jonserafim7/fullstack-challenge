# Standalone Bun app (not a root workspace member). Build context is the repo root so the
# shared @crash/crash-curve source (a sibling under packages/) is present at build time —
# the frontend tsconfig maps the import to ../packages/crash-curve/src, mirroring the layout.

# ---- build stage: install + vite build with bun ----
FROM oven/bun:1-alpine AS build

WORKDIR /app/frontend

# --ignore-scripts: the frontend build needs no lifecycle scripts.
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --ignore-scripts

COPY frontend ./
# The shared multiplier curve and provably-fair verification; resolve at ../packages/<name>/src
# from /app/frontend. Their tsconfig extends the repo-root base, so that must sit at /app too.
COPY packages/crash-curve /app/packages/crash-curve
COPY packages/provably-fair /app/packages/provably-fair
COPY tsconfig.base.json /app/tsconfig.base.json

# provably-fair imports @noble/hashes at runtime. Its source is bundled from its own location, so
# @noble must resolve from there — the frontend install above only populates /app/frontend/
# node_modules, which is off the resolution path for /app/packages/*. Install the package's own
# deps in place (this is what the root workspace install gives it locally).
RUN cd /app/packages/provably-fair && bun install --ignore-scripts

# VITE_* values are inlined at build time by Vite, so they must be present
# before `bun run build`. Provided as build args (browser-facing localhost URLs).
ARG VITE_OIDC_AUTHORITY=http://localhost:8080/realms/crash-game
ARG VITE_OIDC_CLIENT_ID=crash-game-client
ARG VITE_API_BASE_URL=http://localhost:8000
RUN printf "VITE_OIDC_AUTHORITY=%s\nVITE_OIDC_CLIENT_ID=%s\nVITE_API_BASE_URL=%s\n" \
  "$VITE_OIDC_AUTHORITY" "$VITE_OIDC_CLIENT_ID" "$VITE_API_BASE_URL" > .env

# SPA mode emits the prerendered shell as dist/client/_shell.html. Expose it as
# index.html so it is the directory index and the SPA fallback target.
RUN bun run build && cp dist/client/_shell.html dist/client/index.html

# ---- runtime stage: serve the static SPA via nginx ----
# nginx serves the static assets and falls back to index.html so the
# client-side router can handle /login, /auth/callback, etc. on refresh.
FROM nginx:alpine AS runtime

RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/frontend/dist/client /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
