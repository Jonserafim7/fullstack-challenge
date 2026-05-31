# AGENTS.md

This file provides guidance to coding agents (Claude Code, Codex, etc.) when working in this repository. It is the canonical agent guide; `CLAUDE.md` points here.

## What this is

A take-home challenge to build a real-time multiplayer **Crash Game** (casino-style: a multiplier rises from `1.00x` and "crashes" at a pre-determined point; players bet before the round and must cash out before the crash). Read `README.md` for the full spec, game rules, evaluation criteria, and bonus features — it is the source of truth for requirements.

This repo is a **fork** of `junglegaming/fullstack-challenge`. Remotes: `origin` → your fork (the public deliverable), `upstream` → the original challenge repo. Push work to `origin`; pull upstream only if the challenge is updated.

**Current state:** The repo is a scaffold. Both backend services boot a NestJS app exposing only `GET /health`. The `domain/`, `application/`, and `infrastructure/` folders are empty (`.gitkeep` only). `frontend/` and `packages/` are empty and must be built from scratch. The actual game engine, wallet logic, messaging, provably-fair algorithm, WebSocket layer, and frontend are all yet to be implemented.

## Commands

Bun monorepo (workspaces: `services/*`, `packages/*`, `frontend`). Run from the repo root unless noted.

```bash
bun install            # install all workspace deps
bun run docker:up      # bring up everything (infra + services); HARD REQUIREMENT: must work with zero manual steps
bun run docker:down    # stop containers
bun run docker:prune   # remove containers, volumes, images
```

Per-service (run from `services/games` or `services/wallets`):

```bash
bun run dev            # hot-reload via bun --watch src/main.ts
bun run start          # run once
bun test tests/unit    # unit tests (also: bun run test)
bun test tests/e2e     # e2e tests — requires docker:up (also: bun run test:e2e)
bun test path/to/file.test.ts   # run a single test file
bun test -t "name"     # run tests matching a name
```

Tests use the **Bun test runner** (not Jest/Vitest).

## Architecture

Two independent NestJS services behind a Kong API gateway, communicating **asynchronously via RabbitMQ** (never synchronously). The async event design between services is a central evaluation point — model events, flows, and compensation/saga strategies explicitly.

```
Frontend ──HTTP/REST + WebSocket──> Kong (:8000) ──> games (:4001) / wallets (:4002)
                                                       │              │
                                              PostgreSQL (games, wallets DBs) + RabbitMQ
```

- **games service** — round lifecycle, bets, crash logic, provably-fair, WebSocket push. WebSocket is **server→client only**; all player actions (bet, cashout) go through REST.
- **wallets service** — player balance, credit/debit. Credit/debit are **not** REST endpoints; they happen via the message broker.

### Service internals (DDD layering)

Each service follows strict DDD layer separation; preserve it when adding code:

```
src/
  domain/          # entities, aggregates, value objects, invariants — no framework deps
  application/     # use cases, orchestration
  infrastructure/  # ORM, broker, external adapters
  presentation/    # NestJS controllers + DTOs
  main.ts          # bootstrap; binds to 0.0.0.0, PORT from env
  app.module.ts    # root module
```

### Kong path stripping (important)

Kong routes `/games/*` and `/wallets/*` with `strip_path: true` (`docker/kong/kong.yml`). The prefix is removed before reaching the service, so controllers define routes **without** the `/games` or `/wallets` prefix. Example: `GET /games/health` via Kong maps to `@Get("health")` in the controller. The README's API table lists the public (Kong) paths; subtract the prefix when writing controllers.

## Non-negotiable constraints

These come from the README's elimination/disqualification criteria — violating them fails the challenge:

- **Never use floating point for money.** Use integer cents (`BIGINT`), `NUMERIC`, or a Decimal library. Balance must never go negative.
- **`bun run docker:up` must bring up the entire stack with no manual steps** — Keycloak realm import, Kong config, and DB migrations all automatic.
- Services must stay separate and communicate via RabbitMQ/SQS, not direct calls.
- Backend must validate JWTs from the IdP. **Auth is pre-configured, not something to build** — Keycloak realm `crash-game` auto-imports on startup; test user `player` / `player123`; client `crash-game-client` (public, PKCE S256).
- Tests must exist (domain unit tests + API e2e).
- TypeScript strict patterns are expected (`noImplicitAny`, `strictNullChecks` are already on in `tsconfig.json`).

## Infrastructure reference

| Service    | Port(s)              | Notes                                                              |
| ---------- | -------------------- | ----------------------------------------------------------------- |
| Kong       | 8000 proxy, 8001 admin | DB-less/declarative, config at `docker/kong/kong.yml`           |
| PostgreSQL | 5432                 | `admin`/`admin`; databases `games` + `wallets` (init script)      |
| RabbitMQ   | 5672 AMQP, 15672 UI  | `admin`/`admin`                                                   |
| Keycloak   | 8080                 | admin `admin`/`admin`; realm at `docker/keycloak/realm-export.json` |
| games      | 4001                 | env from `services/games/.env`                                    |
| wallets    | 4002                 | env from `services/wallets/.env`                                  |
| frontend   | 3000                 | placeholder commented out in `docker-compose.yml` — uncomment after scaffolding |

Infra credentials are hardcoded in `docker-compose.yml` (local dev only). Each service has `.env.example`; copy to `.env` to run outside Docker (the `.env` files are git-ignored but required by `docker-compose.yml`'s `env_file`).

The infra is fully swappable (SQS instead of RabbitMQ, another gateway/IdP, etc.) as long as `docker:up` still brings up everything in one command.

## Frontend (`frontend/`)

Scaffolded: **TanStack Start (SPA mode)** + **Tailwind v4** + **shadcn/ui**, a **standalone Bun app** (its own `bun.lock`, intentionally **not** a root `workspaces` member). Building the Player UI per ADR-0006 — issue #3 first (OIDC login + balance), the live game later. Architecture (ADR-0006): TanStack Query for REST reads, Zustand for WebSocket-pushed live state, the multiplier on a `<canvas>`/rAF off React state, dark casino aesthetic.

Auth (ADR-0006): `oidc-client-ts`, authorization-code + PKCE S256 against Keycloak client `crash-game-client`. Access token held **in memory** (`InMemoryWebStorage` for the userStore); PKCE/state in `sessionStorage` (stateStore); never `localStorage`. Persistence across reloads via silent renew; `Authorization: Bearer` on REST. The main route is guarded via TanStack Router `beforeLoad` reading `auth` from the router context.

Gotchas / conventions:
- `src/router.tsx` must export **`getRouter`** (start-server-core ≥1.169), not `createRouter`.
- `src/routeTree.gen.ts` is git-ignored (regenerated by the Vite plugin on dev/build) — generate it before any standalone typecheck.
- Browser → Kong at `http://localhost:8000` is cross-origin; Kong needs a CORS plugin allowing `http://localhost:3000` (none in `docker/kong/kong.yml` by default). Keycloak authority (browser) = `http://localhost:8080/realms/crash-game`.
- Browser-facing config via `VITE_*` env (`VITE_OIDC_AUTHORITY`, `VITE_OIDC_CLIENT_ID`, `VITE_API_BASE_URL`).
- Run frontend scripts from the `frontend/` directory (`bun run <script>`) — it is standalone, not a root workspace.
- **Do not add `frontend` to the root `workspaces`**: a literal (non-glob) member breaks the isolated service Docker builds (`bun install` → `error: Workspace not found "frontend"`), because the games/wallets build contexts don't copy `frontend/`.
- `frontend/Dockerfile` (build context `./frontend`) builds the static SPA and serves it via nginx (port 3000); the `frontend` block in `docker-compose.yml` is active.

## Conventions

- **Commits:** conventional commits (`type(scope): description`). The challenge grades git history (atomic commits, clear messages, logical progression) — 10% of the score.
- Shared code between services goes in `packages/` as `@crash/*` workspace packages.

## Agent skills

### Issue tracker

Issues are tracked as GitHub issues on the `origin` fork, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage roles map 1:1 to default label names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
