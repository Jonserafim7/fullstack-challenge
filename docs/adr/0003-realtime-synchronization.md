# Real-time synchronization over WebSocket

## Status

Accepted

## Context

The frontend must show a live rising multiplier, the betting countdown, crashes, and other players' bets and cashouts, kept in sync across all clients. The WebSocket is server→client only — every player action goes through REST — and the event design, payloads, and multiplier-sync strategy are explicitly graded. Keeping many clients on the same curve under latency, without flooding the network, is the hard part.

## Decision

### The displayed multiplier is cosmetic

Cashout is authoritative server-side (ADR-0001): when a cashout request arrives, games computes the locked multiplier from the server clock. The client's multiplier never decides money, so it only needs good-enough visual sync, not financial-grade sync. (Residual: a client showing `2.50x` may lock `2.48x` due to latency — inherent and acceptable.)

### Multiplier as a deterministic function of time, not streamed ticks

- A shared, deterministic growth curve `m(t)` (exponential, `m(0) = 1.00`, configurable rate) is computed client-side via `requestAnimationFrame`. The server never streams per-tick multiplier values.
- The server emits only phase-change events. Between `round.running` and `round.crashed` the client computes `m(t)` locally; being a pure function of elapsed time, every client draws the same curve.
- The client anchors `t ≈ 0` at the moment it receives `round.running` (no absolute clock sync) and snaps to the authoritative crash point on `round.crashed`, correcting any drift.

### Event catalog (server→client)

| Event | When | Payload |
| --- | --- | --- |
| `round.betting_opened` | enters Betting | `roundId`, `seedHash`, `bettingEndsAt` |
| `round.running` | Betting → Running | `roundId`, `startedAt` |
| `round.crashed` | Running → Crashed | `roundId`, `crashPoint`, `crashedAt`, `verification { serverSeed, previousSeed, clientSeed, houseEdge }` |
| `bet.confirmed` | debit confirmed | `roundId`, `username`, `amount` |
| `bet.cashed_out` | player cashes out | `roundId`, `username`, `multiplier`, `payout` |

`seedHash` for Round `r` is `s_{r-1}` (the previous Round's revealed seed, or the genesis Commitment for the first Round) — it is already the commitment to `s_r`, so no extra per-round commitment is published.

### Channels

Public broadcast for `bet.confirmed` and `bet.cashed_out` (the live bets list and cashout highlights are public). Private, owner-only delivery for `bet.rejected` and `bet.voided` — other players never see a bet that did not participate.

### Snapshot via REST, deltas via WebSocket

On connect the client fetches `GET /games/rounds/current` for the current state (phase, `startedAt`, current bets) and then subscribes to the WebSocket for deltas. The socket carries no initial-state replay.

### Balance freshness without a wallets socket

The wallets service exposes no WebSocket. The frontend refetches `GET /wallets/me` (TanStack Query invalidation) on relevant game events (own cashout, round end). Because the payout credit is eventually consistent, the displayed balance reconciles within milliseconds; the UI may optimistically add the payout on the player's own cashout and reconcile on refetch.

## Considered alternatives

- **Server-streamed multiplier ticks.** Rejected: needless bandwidth and jitter, and clients would still drift between ticks; a deterministic client-side curve is identical for every client for free.
- **Absolute clock synchronization (NTP-lite offset estimation).** Rejected: complexity unjustified for a cosmetic value; start-on-receipt plus crash-snap is sufficient.
- **A wallets WebSocket pushing balance updates.** Rejected: keeps wallets free of a delivery channel it otherwise does not need; REST refetch triggered by game events is simpler and the balance is not latency-critical.
- **Replaying state over the WebSocket for late joiners.** Rejected: REST `GET /rounds/current` already provides a clean snapshot; mixing snapshot and delta over one channel is more complex.

## Consequences

- The growth curve `m(t)` is shared contract between client and server and must stay in lockstep; it doubles as the "curve formula on the UI" bonus.
- Clients briefly diverge during a round (latency-dependent) and converge on the crash snap.
- A client's displayed multiplier can exceed the value its own cashout locks, by a latency margin.
