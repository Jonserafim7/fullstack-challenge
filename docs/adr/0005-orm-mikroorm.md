# ORM: MikroORM

## Status

Superseded by [ADR-0007](./0007-persistence-with-prisma.md) (2026-05-31). Kept as historical record. The repository pattern and the ORM-free domain below still hold — only the ORM itself changed (MikroORM → Prisma). The "swapping ORMs later touches only infrastructure" consequence is exactly what made that change cheap.

## Context

Both services persist to PostgreSQL. The challenge accepts MikroORM, Prisma, or TypeORM. Three forces decide it: fit with the DDD layering (graded), Bun compatibility (the runtime), and transactional support for the outbox pattern (ADR-0001 requires writing aggregate state and an outbox row in one transaction). Migrations must run automatically on `docker:up` (elimination criterion).

## Decision

Use MikroORM in both services.

- Data Mapper with **Unit of Work and Identity Map** — domain entities stay rich (behaviour, not anemic records), so persistence does not bleed into the domain layer.
- The Unit of Work makes the **transactional outbox** natural: persist the aggregate and enqueue the event in a single transaction.
- Pure TypeScript with **no native query engine**, so it runs on Bun without binary friction.
- Official NestJS integration (`@mikro-orm/nestjs`).
- Migrations run automatically at service bootstrap via the MikroORM migrator, satisfying the zero-manual-step requirement.

## Considered alternatives

- **Prisma.** Rejected: best DX and migrations, but the generated client is anemic — preserving DDD means maintaining separate domain entities and mapping to Prisma models, more boilerplate; and Prisma's native query engine can be a friction point on Bun.
- **TypeORM.** Rejected: mature and Nest-friendly, but entity decorators couple the domain to persistence, and its weaker Unit of Work is a poorer fit for the transactional outbox.

## Consequences

- Domain entities are mapped via MikroORM metadata kept in the infrastructure layer, so the domain stays clean.
- The migrator runs on boot; a failed migration must fail service start loudly rather than continue.
