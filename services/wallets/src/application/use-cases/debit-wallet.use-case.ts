import { Injectable, Logger } from "@nestjs/common";
import {
  debitConfirmedKey,
  MessageType,
  RoutingKey,
  type DebitCommandPayload,
  type MessageEnvelope,
} from "@crash/messaging";
import { DuplicateMessageError } from "../errors/duplicate-message.error";
import { InboxStore } from "../messaging/inbox-store";
import { NewOutboxMessage } from "../messaging/outbox-store";

// Applies a `wallet.debit` command exactly once (ADR-0001): the inbox debits the player's wallet
// and enqueues the `bet.debit-confirmed` reply in one transaction, so the balance delta, the dedup
// key, and the reply commit together. A redelivered debit hits the inbox primary key, surfaces as
// DuplicateMessageError, and is swallowed as a no-op — money moves once. This is the happy path;
// the insufficient-funds rejection reply (DebitRejected) arrives with #7.
@Injectable()
export class DebitWalletUseCase {
  private readonly logger = new Logger(DebitWalletUseCase.name);

  constructor(private readonly inbox: InboxStore) {}

  async handle(envelope: MessageEnvelope): Promise<void> {
    const { betId, playerId, stakeCents } =
      envelope.payload as DebitCommandPayload;
    try {
      await this.inbox.recordDebit({
        messageKey: envelope.messageKey,
        type: envelope.type,
        playerId,
        stakeCents,
        reply: this.confirmationReply(betId),
      });
    } catch (error) {
      if (error instanceof DuplicateMessageError) {
        this.logger.debug(`Ignoring redelivered debit ${envelope.messageKey}`);
        return;
      }
      throw error;
    }
  }

  private confirmationReply(betId: string): NewOutboxMessage {
    return {
      messageKey: debitConfirmedKey(betId),
      type: MessageType.BET_DEBIT_CONFIRMED,
      routingKey: RoutingKey.BET_DEBIT_CONFIRMED,
      payload: { betId },
    };
  }
}
