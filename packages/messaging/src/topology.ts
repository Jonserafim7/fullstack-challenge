export const Exchange = {
  EVENTS: "crash.events",
  DEAD_LETTER: "crash.dlx",
} as const;
export type Exchange = (typeof Exchange)[keyof typeof Exchange];

export const Queue = {
  WALLETS_INBOX: "wallets.inbox",
  GAMES_INBOX: "games.inbox",
  WALLETS_DLQ: "wallets.dlq",
  GAMES_DLQ: "games.dlq",
  WALLETS_RETRY: "wallets.retry",
  GAMES_RETRY: "games.retry",
} as const;
export type Queue = (typeof Queue)[keyof typeof Queue];

export const RoutingKey = {
  WALLET_DEBIT: "wallet.debit",
  BET_DEBIT_CONFIRMED: "bet.debit-confirmed",
  BET_DEBIT_REJECTED: "bet.debit-rejected",
  WALLET_PAYOUT: "wallet.payout",
  WALLET_REFUND: "wallet.refund",
  RETRY_WALLETS: "retry.wallets",
  RETRY_GAMES: "retry.games",
  REDELIVER_WALLETS: "redeliver.wallets",
  REDELIVER_GAMES: "redeliver.games",
} as const;
export type RoutingKey = (typeof RoutingKey)[keyof typeof RoutingKey];

// Payout and refund are unconditional credits — the outbox relay never gives up on them (ADR-0001).
export const CREDIT_ROUTING_KEYS: readonly RoutingKey[] = [
  RoutingKey.WALLET_PAYOUT,
  RoutingKey.WALLET_REFUND,
];

export const MessageType = {
  WALLET_DEBIT: "wallet.debit",
  BET_DEBIT_CONFIRMED: "bet.debit-confirmed",
  BET_DEBIT_REJECTED: "bet.debit-rejected",
  WALLET_PAYOUT: "wallet.payout",
  WALLET_REFUND: "wallet.refund",
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const DeadLetterRoutingKey = {
  WALLETS: "dlq.wallets",
  GAMES: "dlq.games",
} as const;
export type DeadLetterRoutingKey =
  (typeof DeadLetterRoutingKey)[keyof typeof DeadLetterRoutingKey];
