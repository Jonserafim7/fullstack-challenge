export interface DebitCommandPayload {
  betId: string;
  playerId: string;
  stakeCents: number;
}

export interface DebitConfirmedPayload {
  betId: string;
}

export const DebitRejectionReason = {
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
} as const;
export type DebitRejectionReason =
  (typeof DebitRejectionReason)[keyof typeof DebitRejectionReason];

export interface DebitRejectedPayload {
  betId: string;
  playerId: string;
  reason: DebitRejectionReason;
}

export interface PayoutCommandPayload {
  betId: string;
  playerId: string;
  amountCents: number;
}

export interface RefundCommandPayload {
  betId: string;
  playerId: string;
  amountCents: number;
}
