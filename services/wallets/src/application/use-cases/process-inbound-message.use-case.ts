import { Injectable, Logger } from "@nestjs/common";
import {
  MessageType,
  RoutingKey,
  smokePongKey,
  type MessageEnvelope,
  type SmokePayload,
} from "@crash/messaging";
import { DuplicateMessageError } from "../errors/duplicate-message.error";
import { InboxStore } from "../messaging/inbox-store";
import { NewOutboxMessage } from "../messaging/outbox-store";

// Applies an inbound broker message exactly once (ADR-0001). The inbox records the message key
// and the resulting outbox messages in one transaction; a redelivery hits the inbox primary key,
// surfaces as DuplicateMessageError, and is swallowed as a no-op. For #6 the only effect is the
// pong reply; the bet saga (#14) adds the real money effects here behind the same guarantee.
@Injectable()
export class ProcessInboundMessageUseCase {
  private readonly logger = new Logger(ProcessInboundMessageUseCase.name);

  constructor(private readonly inbox: InboxStore) {}

  async handle(envelope: MessageEnvelope): Promise<void> {
    try {
      await this.inbox.recordAndEnqueue({
        messageKey: envelope.messageKey,
        type: envelope.type,
        outbox: this.effectsFor(envelope),
      });
    } catch (error) {
      if (error instanceof DuplicateMessageError) {
        this.logger.debug(
          `Ignoring redelivered message ${envelope.messageKey}`,
        );
        return;
      }
      throw error;
    }
  }

  private effectsFor(envelope: MessageEnvelope): NewOutboxMessage[] {
    if (envelope.type === MessageType.SMOKE_PING) {
      const { correlationId } = envelope.payload as SmokePayload;
      const reply: SmokePayload = { correlationId };
      return [
        {
          messageKey: smokePongKey(correlationId),
          type: MessageType.SMOKE_PONG,
          routingKey: RoutingKey.SMOKE_PONG,
          payload: reply,
        },
      ];
    }
    return [];
  }
}
