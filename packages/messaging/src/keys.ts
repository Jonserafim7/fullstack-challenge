export function debitKey(betId: string): string {
  return `debit:${betId}`;
}

export function debitConfirmedKey(betId: string): string {
  return `debit-confirmed:${betId}`;
}

export function payoutKey(betId: string): string {
  return `payout:${betId}`;
}

export function debitRejectedKey(betId: string): string {
  return `debit-rejected:${betId}`;
}

export function refundKey(betId: string): string {
  return `refund:${betId}`;
}
