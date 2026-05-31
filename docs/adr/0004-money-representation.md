# Money representation

## Status

Accepted

## Context

Money must never use floating point and balances must never go negative — both are elimination criteria. The challenge accepts integer minor units (`BIGINT`), `NUMERIC`, or a Decimal library. Amounts are small (max bet `1,000.00`). The tricky operation is `payout = stake × multiplier`, where the multiplier has two decimals.

## Decision

Represent all money as integer minor units (cents) stored as `BIGINT`, wrapped in a `Money` value object in the domain layer. No floating point anywhere.

- Internally `Money` holds the amount as a JS `bigint` — an arbitrary-precision integer. The type itself forbids fractions and has no overflow ceiling, so exactness is a property of the type, not of programmer discipline.
- The multiplier is carried as an integer in hundredths (`2.47` → `247`) for arithmetic.
- `payout_cents = floor(stake_cents × multiplierHundredths / 100)`, computed with integer (`bigint`) math.
- Rounding is `floor` (truncation) — conventional and house-favourable on sub-cent fractions.
- The `Money` value object centralizes add / subtract / multiply and stops raw cents leaking through the code.

## Considered alternatives

- **`NUMERIC` in Postgres.** Rejected: exact in the database, but reading into JS returns a string, and converting to `number` reintroduces float; manipulating it still wants a Decimal library — more moving parts than integer cents.
- **A Decimal library (dinero.js, big.js).** Rejected: robust, but an extra dependency and more ceremony for a domain whose numbers fit trivially in integers.

## Consequences

- A `BIGINT` column maps 1:1 to `bigint`, so balances round-trip through the database with no lossy `Number()` conversion (which a `number`-backed `Money` would silently incur past 2^53).
- Every boundary (DB column, DTO, WebSocket payload) carries integer cents; the frontend formats to a display string at the very edge.
- JSON is the one place `bigint` is not serialisable, so the response DTO converts to `number` at that edge only. This is safe because real balances are far below 2^53 — the exactness that matters (storage + arithmetic) stays `bigint`.
- The multiplier needs a fixed-point integer representation (hundredths) wherever it touches money.
- `floor` rounding means the house keeps sub-cent remainders; documented so it is not mistaken for a bug.
