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
  // wallets consumes the commands it must act on: debit, payout, refund.
  WALLETS_INBOX: "wallets.inbox",
  // games consumes the replies: debit-confirmed, debit-rejected.
  GAMES_INBOX: "games.inbox",
  WALLETS_DLQ: "wallets.dlq",
  GAMES_DLQ: "games.dlq",
  // Delay queues for backoff retries (#7): a transient-failure message is parked here with a
  // per-message TTL, then dead-letters back to the owning inbox once the delay elapses. Never
  // consumed — messages only wait and expire.
  WALLETS_RETRY: "wallets.retry",
  GAMES_RETRY: "games.retry",
} as const;
export type Queue = (typeof Queue)[keyof typeof Queue];

// Routing keys are hierarchical so the exchange can fan money movements to the right queue without
// re-topology. The bet saga uses the debit command and its confirmation reply; #8 added the payout;
// #7 adds the rejection reply and the refund command.
export const RoutingKey = {
  // Command: games asks wallets to debit a bet's stake. Lands on wallets.inbox.
  WALLET_DEBIT: "wallet.debit",
  // Reply: wallets confirms the stake left the wallet. Lands on games.inbox.
  BET_DEBIT_CONFIRMED: "bet.debit-confirmed",
  // Reply: wallets refused the debit (insufficient funds), so games marks the Bet Rejected and
  // tells only its owner. Lands on games.inbox (#7, ADR-0001).
  BET_DEBIT_REJECTED: "bet.debit-rejected",
  // Command: games tells wallets to credit a cashed-out bet's payout. Lands on wallets.inbox.
  // Fire-and-forget — the credit is unconditional, so there is no reply (#8, ADR-0001).
  WALLET_PAYOUT: "wallet.payout",
  // Command: games tells wallets to refund a Voided bet whose debit landed late. Like the payout it
  // is an unconditional credit with no reply, deduped on `refund:{betId}` (#7, ADR-0001).
  WALLET_REFUND: "wallet.refund",
  // Backoff plumbing (#7): a consumer republishes a transiently-failed message under `retry.<svc>`
  // to park it in that service's delay queue; when the TTL elapses the queue dead-letters it back
  // to the inbox under `redeliver.<svc>` (the inbox dispatches by envelope type, so one redeliver
  // key per service is enough — the original routing key need not be preserved).
  RETRY_WALLETS: "retry.wallets",
  RETRY_GAMES: "retry.games",
  REDELIVER_WALLETS: "redeliver.wallets",
  REDELIVER_GAMES: "redeliver.games",
} as const;
export type RoutingKey = (typeof RoutingKey)[keyof typeof RoutingKey];

// The unconditional credits (ADR-0001): payout and refund are never abandoned, so the outbox relay
// exempts them from the give-up-after-N cap. Kept here so producer and relay agree on the set
// instead of accreting `OR routingKey = ...` clauses as new credit types appear.
export const CREDIT_ROUTING_KEYS: readonly RoutingKey[] = [
  RoutingKey.WALLET_PAYOUT,
  RoutingKey.WALLET_REFUND,
];

// Message types travel in the envelope and mirror the routing key they ship under.
export const MessageType = {
  WALLET_DEBIT: "wallet.debit",
  BET_DEBIT_CONFIRMED: "bet.debit-confirmed",
  BET_DEBIT_REJECTED: "bet.debit-rejected",
  WALLET_PAYOUT: "wallet.payout",
  WALLET_REFUND: "wallet.refund",
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
