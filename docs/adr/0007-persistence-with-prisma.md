# ADR-0007: Persistence with Prisma (supersedes ADR-0005)

## Status

Accepted (2026-05-31). Supersedes [ADR-0005](./0005-orm-mikroorm.md).

## Context

[ADR-0005](./0005-orm-mikroorm.md) chose MikroORM behind the repository pattern. In practice its implicit machinery — Identity Map, Unit of Work, and constructor-bypassing hydration of rich domain entities — was hard to validate with confidence inside the challenge's timebox: it works, but you have to trust it rather than read it. The team also has more direct familiarity with Prisma.

ADR-0005 deliberately isolated the ORM behind a repository port, so the domain, application, and presentation layers never depend on it. That makes the ORM a swappable infrastructure detail — exactly the property we now exercise.

## Decision

Use **Prisma 7** behind the same repository pattern, in an **engine-free** configuration.

- **Engine-free (query compiler + driver adapter).** The service runs on `oven/bun:1-alpine` (musl libc) under Bun, where Prisma's native Rust query engine is fragile. Prisma 7's query compiler removes the native binary, and the `@prisma/adapter-pg` driver adapter (node-postgres) handles the connection. No per-platform engine binary means `docker:up` is reliable across Windows dev and the Linux container.
- **Domain stays ORM-free.** Prisma returns plain rows, not domain objects. The repository maps explicitly with `toDomain` / `toPersistence`. This trades a little mapper boilerplate for fully explicit, inspectable conversions — there is no hidden hydration to reason about.
- **Schema and config.** The model lives in `prisma/schema.prisma`; the connection URL lives in `prisma.config.ts`, read leniently (`process.env.DATABASE_URL ?? ""`) so `prisma generate` runs at image-build time before the env exists. The URL is only truly needed by `prisma migrate`, which runs at container start.
- **Migrations stay automatic.** `prisma migrate deploy` runs in the container start command, preserving the zero-manual-step `docker:up` requirement.
- **Money maps natively.** `Money` (see [ADR-0004](./0004-money-representation.md)) persists as `BIGINT` ↔ JS `bigint` with no custom type and no `Number()` conversion.
- The generated Prisma Client is git-ignored and regenerated per environment (build step + local `db:generate`).

## Consequences

- **Validates ADR-0005's swappability claim.** The entire ORM was replaced touching only the infrastructure layer; the domain entity, use cases, controllers, ports, and their tests were unchanged.
- **Easier to validate within the deadline.** Readable migration SQL, generated types, and `prisma studio` make the persistence layer inspectable rather than implicit — the reason for the switch.
- **Explicit over implicit.** Mapping is hand-written in the repository (small, obvious) instead of relying on ORM hydration. The same applies to create-vs-update: the repository uses an explicit `upsert`.
- **New build step.** `prisma generate` is codegen that must run before typecheck/build (wired into the Dockerfile and available locally as `db:generate`).
- **Newer path.** The engine-free query compiler is a recent Prisma direction; we pin to Prisma 7.x, where it is the GA default.
- **Forward consistency.** The games service has no persistence yet; when it gains one, it follows this same Prisma shape.
