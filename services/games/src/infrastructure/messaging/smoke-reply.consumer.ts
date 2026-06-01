import { Nack, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, Logger } from "@nestjs/common";
import {
  DeadLetterRoutingKey,
  Exchange,
  Queue,
  RoutingKey,
  type MessageEnvelope,
  type SmokePayload,
} from "@crash/messaging";

// Binds games.inbox to crash.events/smoke.pong and logs the completed round-trip. Games keeps no
// inbox in #6 (the money side dedups, per ADR-0001), so this handler is a plain idempotent log;
// the bet saga (#14) adds the games-side inbox for debit-confirmed/rejected replies.
@Injectable()
export class SmokeReplyConsumer {
  private readonly logger = new Logger(SmokeReplyConsumer.name);

  @RabbitSubscribe({
    exchange: Exchange.EVENTS,
    routingKey: RoutingKey.SMOKE_PONG,
    queue: Queue.GAMES_INBOX,
    queueOptions: {
      durable: true,
      deadLetterExchange: Exchange.DEAD_LETTER,
      deadLetterRoutingKey: DeadLetterRoutingKey.GAMES,
    },
  })
  onSmokePong(envelope: MessageEnvelope): Nack | undefined {
    const payload = envelope?.payload as SmokePayload | undefined;
    if (!payload?.correlationId) {
      this.logger.warn("Discarding a smoke pong with no correlation id");
      return new Nack(false);
    }
    this.logger.log(`Smoke round-trip complete: ${payload.correlationId}`);
    return undefined;
  }
}
