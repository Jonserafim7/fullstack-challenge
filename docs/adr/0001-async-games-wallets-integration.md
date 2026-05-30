# Async event-driven integration between games and wallets

## Status

Accepted

## Context

The games and wallets services own different things — games owns Rounds and Bets, wallets owns money — and the challenge requires them to communicate asynchronously over RabbitMQ, never via synchronous calls. The event design, cross-service consistency, and compensation strategy are explicitly graded. Money correctness is non-negotiable: balances must never go negative and floating point is banned for money.

## Decision

Integrate the two services as an event-driven saga with the shape below.

### Ownership and invariants

- **wallets** is the source of truth for money. It enforces _balance never negative_ and decides whether a debit succeeds.
- **games** owns the Round/Bet lifecycle. It enforces _one bet per round_ and _bets only during Betting_.

### Bet placement is an optimistic saga (fire-and-forget)

- `POST /games/bet` creates a Bet in `Pending` and returns `202` immediately; games emits a debit command.
- wallets debits and replies `DebitConfirmed` → Bet becomes `Confirmed`, or `DebitRejected` (insufficient funds) → Bet becomes `Rejected`. The final outcome is pushed to the client over WebSocket.
- A Bet is never valid without a confirmed debit — _balance rules, not the clock_.

### Money moves incrementally; crash settlement moves nothing

- **Debit-on-bet:** the stake leaves the wallet when the Bet is `Confirmed`. A `Lost` bet therefore moves no money — the stake already left.
- **Cashout is authoritative and synchronous in games:** the instant a player cashes out, games locks the current multiplier and marks the Bet `Cashed Out`; the payout credit (`stake × locked multiplier`) follows asynchronously. Giving money needs no approval from the money's owner, so games can decide it alone — this prevents a player from "losing" a cashout to wallets latency during a crash.
- A Round reaches `Settled` when every Bet is in a terminal game state (`Cashed Out` / `Lost` / `Voided`); it does **not** wait for pending credits to land. Money is eventually consistent and tracked per Bet.

### Conditional debits, unconditional credits (the failure spine)

- **Debits are conditional:** they need funds _and_ a deadline. The deadline is round start — a Bet still `Pending` when the Round leaves `Betting` is `Voided` (it never participated). If its debit lands afterward, games issues a `Refund`. wallets stays ignorant of game time.
- **Credits (payout and refund) are unconditional:** there is no business reason for them to fail, only delay. They are retried until they land and never abandoned. A slow or down wallets therefore only delays processing — bets void at round start, payouts wait in the durable queue.

### Exactly-once over at-least-once delivery

- Each money movement carries a deterministic, producer-assigned idempotency key: `debit:{betId}`, `payout:{betId}`, `refund:{betId}`.
- wallets keeps an **inbox/dedup** table; it applies the balance delta and records the movement key in the **same DB transaction**. Redelivery of a seen key is a no-op.
- Both services use the **outbox** pattern: the state change and the event enqueue commit in one local transaction; a relay publishes to RabbitMQ. No dual-write loss.
- Poison messages dead-letter after N attempts; transient failures retry with exponential backoff and a cap via RabbitMQ retry queues.

## Considered alternatives

- **Synchronous request/reply over the broker** for bet confirmation (block the HTTP request until wallets answers). Rejected: reintroduces temporal coupling — games becomes hostage to wallets latency and availability — and is "async in transport, synchronous in semantics", against the event-driven intent being graded.
- **Batch settlement at crash** (reserve stakes during the round, then credit winners and finalize losers all at once on crash). Rejected: redundant under debit-on-bet plus incremental cashout credits, and more complex.
- **Block round start until all debits resolve** (so no `Pending` bets exist at start). Rejected: couples game timing to wallets latency — one hung debit would freeze the round for every player, trading liveness for the consistency of a single bet.
- **Per-player FIFO ordering** so a pending payout is always credited before the next round's debit. Deferred: solves only a few-millisecond edge (a fast re-bet of unspent winnings can be rejected) at the cost of partitioned, keyed consumers. We accept eventual consistency — players bet against confirmed balance — and note FIFO as a future upgrade.

## Consequences

- A terminal Bet state `Voided` and a compensating `Refund` credit exist solely to handle bets whose debit lands after round start.
- Players bet against confirmed balance; winnings are not spendable until the credit lands (normally instantaneous).
- Clients see a brief `Pending` state on bet placement, resolved over WebSocket.
- Outbox relay and inbox dedup tables are required infrastructure in both services.
