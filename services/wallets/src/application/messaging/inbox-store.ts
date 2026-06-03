import { NewOutboxMessage } from "./outbox-store";

export abstract class InboxStore {
  abstract recordAndEnqueue(args: {
    messageKey: string;
    type: string;
    outbox: NewOutboxMessage[];
  }): Promise<void>;

  // Insufficient funds is a committed outcome (enqueues rejectReply, moves no money); WalletNotFoundError is an anomaly that throws (retry/DLQ).
  abstract recordDebit(args: {
    messageKey: string;
    type: string;
    playerId: string;
    stakeCents: number;
    confirmReply: NewOutboxMessage;
    rejectReply: NewOutboxMessage;
  }): Promise<void>;

  // Credits are unconditional — no balance guard, cannot fail on a business rule, only delay.
  abstract recordCredit(args: {
    messageKey: string;
    type: string;
    playerId: string;
    amountCents: number;
  }): Promise<void>;
}
