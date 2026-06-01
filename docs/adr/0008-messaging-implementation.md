# ADR-0008: Messaging implementation — RabbitMQ client, transactional outbox, idempotent inbox

## Status

Accepted (2026-06-01). Implements the messaging infrastructure mandated by [ADR-0001](./0001-async-games-wallets-integration.md).

## Context

[ADR-0001](./0001-async-games-wallets-integration.md) defined the games↔wallets saga and its reliability contract — producer-assigned idempotency keys, an inbox that dedups in the same transaction as the effect, an outbox in both services, and dead-lettering — but left the concrete mechanism open. This ADR pins the library, topology, and drain mechanism so the bet saga (#14), Cash Out (#8), and the edge cases (#7) inherit a proven path instead of each reinventing it.

The challenge grades the async design directly and lists transactional outbox/inbox as a bonus. This slice builds the plumbing only, proven with a trivial `smoke.ping → smoke.pong` round-trip and a redelivery-dedup test, before any real Bet exists.

## Decision

### RabbitMQ client: `@golevelup/nestjs-rabbitmq`

Declarative topology (exchanges, queues, bindings, dead-letter routing), connection and channel lifecycle, and publisher confirms come out of the box, with clean NestJS dependency injection. The alternatives were weaker fits (see below). Consumer handlers are bound with the `@RabbitSubscribe` method decorator and kept **thin** — they delegate immediately to a constructor-injected use-case — so the decorator never lands on a unit-tested class (Bun's test runner uses TC39 decorators, which break NestJS property/parameter decorators).

### Topology

A single durable topic exchange carries every message; a parallel dead-letter exchange collects poison messages.

```
games.outbox ──relay──▶ crash.events (topic, durable)
                              │ smoke.ping              │ smoke.pong
                              ▼                          ▼
                       wallets.inbox              games.inbox
                  (dlx crash.dlx, dlq.wallets)  (dlx crash.dlx, dlq.games)
                              │                          │
              [tx: inbox key + pong in wallets.outbox]   └─▶ log "round-trip complete {id}"
                              │
                       wallets.outbox ──relay──▶ crash.events / smoke.pong

crash.dlx (topic, durable) ──▶ wallets.dlq / games.dlq   (poison messages, no requeue)
```

- **Exchanges:** `crash.events` and `crash.dlx`, both topic + durable.
- **Routing keys are hierarchical** so the exchange fans future money movements to the right queue without re-topology: `smoke.ping` / `smoke.pong` now; `wallet.debit|payout|refund` and `bet.debit-confirmed|rejected` reserved for #14.
- **Each service asserts the topology it touches** on connect (idempotent redeclaration), so neither service has to boot first.
- **Persistence:** exchanges and queues are durable and messages are published `persistent`, so the broker survives a restart.

### Relay drain: polling

A single relay per service wakes every `OUTBOX_POLL_INTERVAL_MS` (default 500 ms), claims `PENDING` rows oldest-first, and publishes each. With one relay per service there is no concurrent claim, so no `FOR UPDATE SKIP LOCKED` and no raw SQL — pure Prisma, which keeps it Bun-friendly. A row is marked `PUBLISHED` **only after the broker confirms** the publish (the golevelup `publish` resolves on the publisher-confirm ack). A failed publish leaves the row `PENDING` and increments `attempts`; once `attempts` reaches `OUTBOX_MAX_ATTEMPTS` (default 10) the row drops out of the drain set and is left for inspection. Sub-second latency is acceptable because credits are eventually consistent (ADR-0001).

### Outbox / inbox schema and the exactly-once contract

- **`outbox_message`** (both services): `id`, unique `message_key`, `type`, `routing_key`, JSONB `payload`, `status`, `attempts`, `created_at`, `published_at`, indexed on `(status, created_at)`. A message is written here in the **same transaction** as the originating state change, so there is no dual-write loss.
- **`inbox_message`** (wallets only): `message_key` is the **primary key** — that constraint is the dedup. Recording the key and applying the effect (for #6, enqueuing the pong into the outbox) happen in one `prisma.$transaction`. A redelivered key violates the primary key (`P2002`), the adapter translates it to a `DuplicateMessageError`, and the use-case swallows it as a no-op. Games keeps no inbox in #6 (the money side dedups, per ADR-0001); #14 adds the games-side inbox for debit replies.
- The deterministic keys (`smoke:{id}` / `smoke-pong:{id}`; `debit:{betId}` etc. in #14) and the topology constants live in the shared **`@crash/messaging`** package so producer and consumer derive identical values. Only the wire contract is shared — the relay, RabbitMQ module, and Prisma stores are duplicated per service (they appear in exactly two places; abstracting once would be premature).

## Considered alternatives

- **Raw `amqplib`.** Maximal control, but we would hand-roll connection lifecycle, reconnection, channel management, and topology assertion — more code and more bug surface in the reliability-critical path.
- **`@nestjs/microservices` (RMQ transport).** First-party, but built around message-pattern / request-reply semantics that ADR-0001 explicitly rejects, and custom dead-letter + retry topology is awkward to express.
- **Postgres `LISTEN/NOTIFY` to wake the relay.** Lower publish latency, but needs a dedicated listener connection *and* a polling safety net for missed notifications — more moving parts than this slice needs.
- **A shared, generic relay/outbox package.** Rejected for now (YAGNI): the relay exists in exactly two services; duplicating it once is cheaper than the abstraction. Only the wire contract, which *must* match on both ends, is shared.

## Consequences

- The bet saga (#14), Cash Out (#8), and edge cases (#7) inherit working rails: they add routing keys, payloads, and effects, not infrastructure.
- New env knobs in both services: `RABBITMQ_URL` (added to games, which previously had none), `OUTBOX_POLL_INTERVAL_MS`, `OUTBOX_MAX_ATTEMPTS`.
- New Prisma models + migrations in both services; they auto-apply via the existing `db:deploy` Dockerfile step, preserving zero-manual-step `docker:up`.
- A poison message dead-letters after a nack (no requeue) and collects in the service's `*.dlq`; full exponential-backoff retry queues are deferred — #6 proves the dead-letter path exists, not a hardened retry policy.
- A publish that fails while the broker is unreachable blocks that relay tick until the connection is restored (the confirm promise is buffered); the per-tick guard prevents overlap. Acceptable for local/dev where the broker is brought up healthy before the services.
