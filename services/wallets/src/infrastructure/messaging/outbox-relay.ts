import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { Exchange, MessageEnvelope } from "@crash/messaging";
import {
  OutboxStore,
  PendingOutboxMessage,
} from "../../application/messaging/outbox-store";
import { EnvService } from "../env/env.service";

const DRAIN_BATCH_SIZE = 20;

// Drains the transactional outbox to RabbitMQ (ADR-0008). Every ~500ms it claims PENDING rows
// and publishes each; a row is only marked PUBLISHED once the broker confirms the publish (the
// golevelup publish resolves on the publisher-confirm ack). A failed publish leaves the row
// PENDING with an incremented attempt count, so it is retried on the next tick.
@Injectable()
export class OutboxRelay
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxRelay.name);
  private readonly intervalMs: number;
  private readonly maxAttempts: number;
  private timer?: ReturnType<typeof setInterval>;
  private draining = false;

  constructor(
    private readonly outbox: OutboxStore,
    private readonly amqp: AmqpConnection,
    env: EnvService,
  ) {
    this.intervalMs = env.get("OUTBOX_POLL_INTERVAL_MS");
    this.maxAttempts = env.get("OUTBOX_MAX_ATTEMPTS");
  }

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => {
      void this.drain();
    }, this.intervalMs);
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async drain(): Promise<void> {
    if (this.draining) {
      return;
    }
    this.draining = true;
    try {
      const pending = await this.outbox.findPending({
        limit: DRAIN_BATCH_SIZE,
        maxAttempts: this.maxAttempts,
      });
      for (const message of pending) {
        await this.publish(message);
      }
    } catch (error) {
      this.logger.error("Failed to drain the outbox", error);
    } finally {
      this.draining = false;
    }
  }

  private async publish(message: PendingOutboxMessage): Promise<void> {
    const envelope: MessageEnvelope = {
      messageKey: message.messageKey,
      type: message.type,
      payload: message.payload,
      occurredAt: message.occurredAt.toISOString(),
    };
    try {
      await this.amqp.publish(Exchange.EVENTS, message.routingKey, envelope, {
        messageId: message.messageKey,
        contentType: "application/json",
      });
      await this.outbox.markPublished(message.id);
    } catch (error) {
      this.logger.warn(
        `Failed to publish ${message.messageKey}; leaving it pending for retry`,
        error,
      );
      await this.outbox.markFailed(message.id);
    }
  }
}
