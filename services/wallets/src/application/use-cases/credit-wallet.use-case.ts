import { Injectable, Logger } from "@nestjs/common";
import {
  type MessageEnvelope,
  type PayoutCommandPayload,
} from "@crash/messaging";
import { DuplicateMessageError } from "../errors/duplicate-message.error";
import { InboxStore } from "../messaging/inbox-store";

// Applies a `wallet.payout` command exactly once (ADR-0001): the inbox credits the player's wallet
// and records the dedup key in one transaction, so the balance delta and the key commit together. A
// redelivered payout hits the inbox primary key, surfaces as DuplicateMessageError, and is swallowed
// as a no-op — money moves once. The credit is unconditional and there is no reply (games already
// decided the cash out); a slow wallets only delays it.
@Injectable()
export class CreditWalletUseCase {
  private readonly logger = new Logger(CreditWalletUseCase.name);

  constructor(private readonly inbox: InboxStore) {}

  async handle(envelope: MessageEnvelope): Promise<void> {
    const { playerId, amountCents } = envelope.payload as PayoutCommandPayload;
    try {
      await this.inbox.recordCredit({
        messageKey: envelope.messageKey,
        type: envelope.type,
        playerId,
        amountCents,
      });
    } catch (error) {
      if (error instanceof DuplicateMessageError) {
        this.logger.debug(`Ignoring redelivered payout ${envelope.messageKey}`);
        return;
      }
      throw error;
    }
  }
}
