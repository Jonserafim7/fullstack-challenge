import { Nack, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, Logger } from "@nestjs/common";
import {
  DeadLetterRoutingKey,
  Exchange,
  MessageType,
  Queue,
  RoutingKey,
  type MessageEnvelope,
  type SmokePayload,
} from "@crash/messaging";
import { ConfirmBetUseCase } from "../../application/use-cases/confirm-bet.use-case";

// The single consumer on games.inbox. It binds every reply games consumes and dispatches by
// message type — one consumer per queue, because two consumers on the same queue would compete and
// a confirmation could be delivered to the smoke handler (AMQP routes to the queue, then
// round-robins its consumers regardless of routing key). A successful (or already-seen,
// deduplicated) message acks; an unexpected failure nacks without requeue, dead-lettering to
// crash.dlx (ADR-0001's poison-message path).
@Injectable()
export class GamesInboxConsumer {
  private readonly logger = new Logger(GamesInboxConsumer.name);

  constructor(private readonly confirmBet: ConfirmBetUseCase) {}

  @RabbitSubscribe({
    exchange: Exchange.EVENTS,
    routingKey: [RoutingKey.SMOKE_PONG, RoutingKey.BET_DEBIT_CONFIRMED],
    queue: Queue.GAMES_INBOX,
    queueOptions: {
      durable: true,
      deadLetterExchange: Exchange.DEAD_LETTER,
      deadLetterRoutingKey: DeadLetterRoutingKey.GAMES,
    },
  })
  async onMessage(envelope: MessageEnvelope): Promise<Nack | undefined> {
    try {
      await this.dispatch(envelope);
      return undefined;
    } catch (error) {
      this.logger.error(
        `Failed to process inbound reply ${envelope?.messageKey}`,
        error,
      );
      return new Nack(false);
    }
  }

  private async dispatch(envelope: MessageEnvelope): Promise<void> {
    switch (envelope.type) {
      case MessageType.BET_DEBIT_CONFIRMED:
        return this.confirmBet.handle(envelope);
      case MessageType.SMOKE_PONG: {
        const payload = envelope.payload as SmokePayload | undefined;
        this.logger.log(`Smoke round-trip complete: ${payload?.correlationId}`);
        return;
      }
      default:
        this.logger.warn(`Ignoring reply of unknown type ${envelope.type}`);
        return;
    }
  }
}
