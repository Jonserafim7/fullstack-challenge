import { Injectable, Logger } from "@nestjs/common";
import {
  type MessageEnvelope,
  type PayoutCommandPayload,
} from "@crash/messaging";
import { DuplicateMessageError } from "../errors/duplicate-message.error";
import { InboxStore } from "../messaging/inbox-store";

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
