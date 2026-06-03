import { Injectable, Logger } from "@nestjs/common";
import {
  debitConfirmedKey,
  debitRejectedKey,
  DebitRejectionReason,
  MessageType,
  RoutingKey,
  type DebitCommandPayload,
  type DebitRejectedPayload,
  type MessageEnvelope,
} from "@crash/messaging";
import { DuplicateMessageError } from "../errors/duplicate-message.error";
import { InboxStore } from "../messaging/inbox-store";
import { NewOutboxMessage } from "../messaging/outbox-store";

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
        confirmReply: this.confirmationReply(betId),
        rejectReply: this.rejectionReply({ betId, playerId }),
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

  private rejectionReply({
    betId,
    playerId,
  }: {
    betId: string;
    playerId: string;
  }): NewOutboxMessage {
    const payload: DebitRejectedPayload = {
      betId,
      playerId,
      reason: DebitRejectionReason.INSUFFICIENT_BALANCE,
    };
    return {
      messageKey: debitRejectedKey(betId),
      type: MessageType.BET_DEBIT_REJECTED,
      routingKey: RoutingKey.BET_DEBIT_REJECTED,
      payload,
    };
  }
}
