// The RabbitMQ topology shared by both services. Each service asserts the parts it uses on
// connect (idempotent redeclaration), so neither has to boot first. See ADR-0008.

export const Exchange = {
  // The single topic exchange every domain message is published to.
  EVENTS: "crash.events",
  // Dead-letter exchange: messages a consumer rejects after exhausting retries land here.
  DEAD_LETTER: "crash.dlx",
} as const;
export type Exchange = (typeof Exchange)[keyof typeof Exchange];

export const Queue = {
  // wallets consumes commands it must act on (the smoke ping now; debit/payout/refund in #14).
  WALLETS_INBOX: "wallets.inbox",
  // games consumes replies (the smoke pong now; debit-confirmed/rejected in #14).
  GAMES_INBOX: "games.inbox",
  WALLETS_DLQ: "wallets.dlq",
  GAMES_DLQ: "games.dlq",
} as const;
export type Queue = (typeof Queue)[keyof typeof Queue];

// Routing keys are hierarchical so the exchange can fan future money movements to the right
// queue without re-topology. The smoke pair proves the rails (#6); the bet saga (#14) adds the
// debit command (games -> wallets) and its confirmation reply (wallets -> games).
export const RoutingKey = {
  SMOKE_PING: "smoke.ping",
  SMOKE_PONG: "smoke.pong",
  // Command: games asks wallets to debit a bet's stake. Lands on wallets.inbox.
  WALLET_DEBIT: "wallet.debit",
  // Reply: wallets confirms the stake left the wallet. Lands on games.inbox.
  BET_DEBIT_CONFIRMED: "bet.debit-confirmed",
  // Command: games tells wallets to credit a cashed-out bet's payout. Lands on wallets.inbox.
  // Fire-and-forget — the credit is unconditional, so there is no reply (#8, ADR-0001).
  WALLET_PAYOUT: "wallet.payout",
} as const;
export type RoutingKey = (typeof RoutingKey)[keyof typeof RoutingKey];

// Message types travel in the envelope and mirror the routing key they ship under.
export const MessageType = {
  SMOKE_PING: "smoke.ping",
  SMOKE_PONG: "smoke.pong",
  WALLET_DEBIT: "wallet.debit",
  BET_DEBIT_CONFIRMED: "bet.debit-confirmed",
  WALLET_PAYOUT: "wallet.payout",
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

// Routing keys under crash.dlx that a service's inbox dead-letters to, so each service's
// poison messages collect in its own dead-letter queue.
export const DeadLetterRoutingKey = {
  WALLETS: "dlq.wallets",
  GAMES: "dlq.games",
} as const;
export type DeadLetterRoutingKey =
  (typeof DeadLetterRoutingKey)[keyof typeof DeadLetterRoutingKey];
