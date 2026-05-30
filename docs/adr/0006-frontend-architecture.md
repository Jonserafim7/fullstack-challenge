# Frontend architecture

## Status

Accepted

## Context

The frontend is an auth-gated, real-time, single-page game with no SEO need — server-side rendering buys nothing. The challenge mandates Tailwind v4 + shadcn/ui, TanStack Query for server state, Zustand or Context for client state, and an OIDC PKCE login against Keycloak. The hard parts are keeping a 60fps multiplier smooth and authenticating both REST and the WebSocket.

## Decision

### Framework: TanStack Start

The house-preferred stack; integrates TanStack Router and TanStack Query natively. SSR is not used for game content — it is private and dynamic.

### State split

- **TanStack Query** owns REST reads: wallet balance (`/wallets/me`), round history, bet history, and the initial snapshot (`/games/rounds/current`).
- **Zustand** owns WebSocket-pushed live state: round phase, the live bets list, current-round metadata. Zustand over Context because the game state changes often and Context re-renders the whole tree; Zustand gives per-slice selective subscriptions.

### The multiplier is outside React state

The rising multiplier is computed per frame in a `requestAnimationFrame` loop from `startedAt` (ADR-0003) and drawn to a `<canvas>`. It never enters `useState` / Zustand — that would re-render every subscriber 60×/s. The textual multiplier and the cashout button's potential payout update via imperative refs inside the same loop (or a ~10fps tick). Canvas at 60fps; React stays off the hot path. The shared `m(t)` doubles as the on-UI curve formula.

### WebSocket integration

A single socket hook receives events and (a) dispatches to the Zustand store (phase, live bets) and (b) invalidates TanStack Query caches when needed — on the player's own `bet.cashed_out` and on round end, invalidate `/wallets/me` (ADR-0003 balance freshness). The UI optimistically adds the payout on the player's own cashout and reconciles on refetch.

### Authentication

- `oidc-client-ts` drives the OIDC authorization-code + PKCE flow — provider-agnostic, so Keycloak can be swapped for Auth0 / Okta.
- The access token is held **in memory**, never in `localStorage` (XSS exposure); persistence across reloads comes from automatic **silent renew**. The user session may live in `sessionStorage` via the library; the live access token does not.
- REST calls send `Authorization: Bearer <access_token>` via a fetch wrapper / Query default.
- The WebSocket authenticates on connect: the token rides the connection auth payload, and the server validates the JWT before allowing subscription (required to scope the private `bet.rejected` / `bet.voided` channels). An invalid connection is closed. On silent renew the client reconnects with a fresh token.
- The game route is guarded (TanStack Router `beforeLoad`); unauthenticated visitors are redirected to login.

## Considered alternatives

- **Next.js / Vite + React** for the framework. Next.js rejected as dead weight without SEO; Vite + React was the lower-risk alternative, but TanStack Start was chosen for stack alignment.
- **Context instead of Zustand** for live state. Rejected: broad re-renders under high-frequency game updates.
- **Multiplier in React state.** Rejected: 60fps re-renders; canvas + refs keep it off the render path.
- **keycloak-js** for auth. Rejected: couples the client to Keycloak and loses provider portability.
- **Access token in localStorage.** Rejected: trivially readable by XSS; in-memory + silent renew is safer.

## Consequences

- The frontend depends on the games WebSocket for liveness and on REST for snapshots and balance; a dropped socket degrades to the last snapshot until reconnect.
- The canvas/rAF curve and the shared growth function must track the backend's `m(t)`.
- Token lifetime drives WebSocket reconnects on renewal.
