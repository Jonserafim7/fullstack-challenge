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
