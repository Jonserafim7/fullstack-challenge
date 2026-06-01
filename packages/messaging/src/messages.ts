// Payload for the #6 smoke round-trip. It carries only a correlation id so a ping can be matched
// to its pong across the broker — no money or domain data. Real money-movement payloads (debit,
// payout, refund) arrive with the bet saga (#14).
export interface SmokePayload {
  correlationId: string;
}

// Command payload for `wallet.debit` (games -> wallets): debit this bet's stake from the player's
// wallet. The betId is the unit of idempotency (key `debit:{betId}`); stakeCents is integer cents
// (ADR-0004 — money is never a float). wallets knows nothing of rounds or usernames.
export interface DebitCommandPayload {
  betId: string;
  playerId: string;
  stakeCents: number;
}

// Reply payload for `bet.debit-confirmed` (wallets -> games): the stake left the wallet, so games
// can mark the Bet Confirmed. Keyed `debit-confirmed:{betId}` for the games-side inbox dedup.
export interface DebitConfirmedPayload {
  betId: string;
}

// The reasons wallets can refuse a debit. Only insufficient funds today; kept as a closed set so
// the client can localize the message and the contract can grow without a breaking change (#7).
export const DebitRejectionReason = {
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
} as const;
export type DebitRejectionReason =
  (typeof DebitRejectionReason)[keyof typeof DebitRejectionReason];

// Reply payload for `bet.debit-rejected` (wallets -> games): wallets refused the debit, so games
// marks the Bet Rejected and notifies only its owner. Carries the playerId so games can address the
// private push without a lookup, and the reason for the UI. Keyed `debit-rejected:{betId}` (#7).
export interface DebitRejectedPayload {
  betId: string;
  playerId: string;
  reason: DebitRejectionReason;
}

// Command payload for `wallet.payout` (games -> wallets): credit this cashed-out bet's payout to the
// player's wallet. betId is the unit of idempotency (key `payout:{betId}`); amountCents is integer
// cents (ADR-0004) = stake × locked multiplier, computed authoritatively by games. The credit is
// unconditional — there is no reply.
export interface PayoutCommandPayload {
  betId: string;
  playerId: string;
  amountCents: number;
}

// Command payload for `wallet.refund` (games -> wallets): return a Voided bet's debited stake to the
// player's wallet. betId is the unit of idempotency (key `refund:{betId}`); amountCents is the
// integer-cents stake (ADR-0004). Like the payout it is an unconditional credit with no reply (#7).
export interface RefundCommandPayload {
  betId: string;
  playerId: string;
  amountCents: number;
}
