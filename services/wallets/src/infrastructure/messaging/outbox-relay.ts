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
        try {
          await this.publish(message);
        } catch (error) {
          this.logger.error(
            `Failed to relay outbox message ${message.messageKey}`,
            error,
          );
        }
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
    } catch (error) {
      this.logger.warn(
        `Failed to publish ${message.messageKey}; leaving it pending for retry`,
        error,
      );
      await this.outbox.markFailed({
        id: message.id,
        maxAttempts: this.maxAttempts,
      });
      return;
    }
    // A failure here leaves the row PENDING for republish next tick; a confirmed publish must not count as a failed attempt.
    await this.outbox.markPublished(message.id);
  }
}
