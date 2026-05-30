# Provably-fair crash point generation

## Status

Accepted

## Context

Each Round's crash point must be pre-determined before betting opens and independently verifiable by any player for any past round, using the standard provably-fair toolkit (hash chains, HMAC, seeds, house edge). Generation, calculation, and verification are all graded. This is owned entirely by the games service; no cross-service interaction is involved.

## Decision

### Server-seed hash chain (the commitment)

- Pre-generate a chain backward from a random terminal seed: `s_{k-1} = SHA256(s_k)`. The genesis `s_0` is published as a single **Commitment** before any Round runs. Round `r` uses seed `s_r`.
- Because reversing SHA-256 is infeasible, publishing `s_0` locks the entire sequence of future crash points in advance.

### Crash point derivation (HMAC + client seed + house edge)

- For Round `r`: `h = HMAC_SHA256(key = s_r, msg = clientSeed)`. Take the first 52 bits of `h` as integer `X ∈ [0, 2^52)`, and `U = X / 2^52`.
- The **house edge** is an instant-bust fraction: with probability `e` the crash is exactly `1.00x`; otherwise `crash = trunc(1 / (1 - U), 2 decimals)`, minimum `1.00`. This makes `RTP = 1 - e` exact and keeps the canonical `1/(1-U)` distribution for non-bust rounds.
- `e` is a configurable constant, default **1%**.
- The **client seed** is public and mixed into every derivation so the operator cannot grind the chain in the house's favour — outcomes depend on input not controlled at commit time.

### Verification (`GET /games/rounds/:roundId/verify`)

- After a Round, its server seed `s_r` is revealed. A player checks `SHA256(s_r) == s_{r-1}` (the previously revealed seed, or `s_0` for the first Round) and can walk the chain back to genesis. They then recompute the HMAC and the crash-point formula to confirm the result.
- The endpoint returns the revealed server seed, the prior seed (or Commitment) for the chain link, the client seed, the house-edge constant, and the resulting crash point.

## Considered alternatives

- **Per-round commit-reveal without a chain** (publish `hash(serverSeed_r)` each round, reveal after). Rejected: yields only a collection of independent commitments — it loses the single up-front Commitment that proves _all_ future rounds and the cross-round linkage.
- **Pure server chain without a client seed.** Rejected: still pre-determines outcomes, but weakens anti-grinding — an operator who also bets could choose a favourable chain.
- **Multiplicative house edge** (`m × (1 - e)`). Rejected: distorts the whole distribution and can produce sub-`1.00` values needing clamps; the instant-bust fraction keeps the edge transparent (`RTP = 1 - e`) and the curve clean.

## Consequences

- A fraction `e` of Rounds crash instantly at `1.00x` — intended, and the mechanism by which the house edge is realised.
- The hash chain is finite; a new chain (and Commitment) must be published when it is exhausted. Choose a large length so this is rare.
- Deterministic E2E test seeding is trivial: seed the chain from a known root and the entire sequence of crash points is reproducible.
