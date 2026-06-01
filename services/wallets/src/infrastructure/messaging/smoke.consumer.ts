import { Nack, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, Logger } from "@nestjs/common";
import {
  DeadLetterRoutingKey,
  Exchange,
  Queue,
  RoutingKey,
  type MessageEnvelope,
} from "@crash/messaging";
import { ProcessInboundMessageUseCase } from "../../application/use-cases/process-inbound-message.use-case";

// Binds wallets.inbox to crash.events/smoke.ping and delegates to the exactly-once use-case.
// A successful (or already-seen, deduplicated) message acks; an unexpected failure nacks without
// requeue, dead-lettering to crash.dlx (ADR-0001's poison-message path).
@Injectable()
export class SmokeConsumer {
  private readonly logger = new Logger(SmokeConsumer.name);

  constructor(private readonly processInbound: ProcessInboundMessageUseCase) {}

  @RabbitSubscribe({
    exchange: Exchange.EVENTS,
    routingKey: RoutingKey.SMOKE_PING,
    queue: Queue.WALLETS_INBOX,
    queueOptions: {
      durable: true,
      deadLetterExchange: Exchange.DEAD_LETTER,
      deadLetterRoutingKey: DeadLetterRoutingKey.WALLETS,
    },
  })
  async onSmokePing(envelope: MessageEnvelope): Promise<Nack | undefined> {
    try {
      await this.processInbound.handle(envelope);
      return undefined;
    } catch (error) {
      this.logger.error(
        `Failed to process inbound message ${envelope?.messageKey}`,
        error,
      );
      return new Nack(false);
    }
  }
}
