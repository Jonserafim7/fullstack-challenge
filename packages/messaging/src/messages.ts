// Payload for the #6 smoke round-trip. It carries only a correlation id so a ping can be matched
// to its pong across the broker — no money or domain data. Real money-movement payloads (debit,
// payout, refund) arrive with the bet saga (#14).
export interface SmokePayload {
  correlationId: string;
}
