import {
  AmqpConnection,
  Nack,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import { Injectable, Logger } from "@nestjs/common";
import {
  DeadLetterRoutingKey,
  Exchange,
  MessageType,
  Queue,
  RoutingKey,
  type MessageEnvelope,
} from "@crash/messaging";
import { nextRetry } from "../../application/messaging/retry-policy";
import { ConfirmBetUseCase } from "../../application/use-cases/confirm-bet.use-case";
import { RejectBetUseCase } from "../../application/use-cases/reject-bet.use-case";
import { EnvService } from "../env/env.service";

// Rides in this header so the count survives the delay-queue round trip.
const RETRY_COUNT_HEADER = "x-retry-count";

// Minimal subset to read the retry header without pulling in amqplib types.
interface AmqpMessageLike {
  properties?: { headers?: Record<string, unknown> | null };
}

// One consumer per queue: AMQP round-robins across consumers regardless of routing key.
@Injectable()
export class GamesInboxConsumer {
  private readonly logger = new Logger(GamesInboxConsumer.name);
  private readonly retryBaseMs: number;
  private readonly retryMaxAttempts: number;

  constructor(
    private readonly confirmBet: ConfirmBetUseCase,
    private readonly rejectBet: RejectBetUseCase,
    private readonly amqp: AmqpConnection,
    env: EnvService,
  ) {
    this.retryBaseMs = env.get("INBOX_RETRY_BASE_MS");
    this.retryMaxAttempts = env.get("INBOX_RETRY_MAX_ATTEMPTS");
  }

  @RabbitSubscribe({
    exchange: Exchange.EVENTS,
    routingKey: [
      RoutingKey.BET_DEBIT_CONFIRMED,
      RoutingKey.BET_DEBIT_REJECTED,
      RoutingKey.REDELIVER_GAMES,
    ],
    queue: Queue.GAMES_INBOX,
    queueOptions: {
      durable: true,
      deadLetterExchange: Exchange.DEAD_LETTER,
      deadLetterRoutingKey: DeadLetterRoutingKey.GAMES,
    },
  })
  async onMessage(
    envelope: MessageEnvelope,
    amqpMsg: AmqpMessageLike,
  ): Promise<Nack | undefined> {
    try {
      await this.dispatch(envelope);
      return undefined;
    } catch (error) {
      return this.scheduleRetryOrDeadLetter(envelope, amqpMsg, error);
    }
  }

  private async scheduleRetryOrDeadLetter(
    envelope: MessageEnvelope,
    amqpMsg: AmqpMessageLike,
    error: unknown,
  ): Promise<Nack | undefined> {
    const { shouldRetry, delayMs, nextAttempt } = nextRetry({
      attempt: readRetryCount(amqpMsg),
      baseMs: this.retryBaseMs,
      maxAttempts: this.retryMaxAttempts,
    });
    if (!shouldRetry) {
      this.logger.error(
        `Giving up on ${envelope?.messageKey} after ${this.retryMaxAttempts} retries; dead-lettering`,
        error,
      );
      return new Nack(false);
    }
    try {
      await this.amqp.publish(
        Exchange.EVENTS,
        RoutingKey.RETRY_GAMES,
        envelope,
        {
          contentType: "application/json",
          messageId: envelope.messageKey,
          expiration: String(delayMs),
          headers: { [RETRY_COUNT_HEADER]: nextAttempt },
        },
      );
      this.logger.warn(
        `Retry ${nextAttempt}/${this.retryMaxAttempts} for ${envelope?.messageKey} in ${delayMs}ms`,
        error,
      );
      return undefined;
    } catch (publishError) {
      this.logger.error(
        `Failed to schedule retry for ${envelope?.messageKey}; requeueing`,
        publishError,
      );
      return new Nack(true);
    }
  }

  private async dispatch(envelope: MessageEnvelope): Promise<void> {
    switch (envelope.type) {
      case MessageType.BET_DEBIT_CONFIRMED:
        return this.confirmBet.handle(envelope);
      case MessageType.BET_DEBIT_REJECTED:
        return this.rejectBet.handle(envelope);
      default:
        this.logger.warn(`Ignoring reply of unknown type ${envelope.type}`);
        return;
    }
  }
}

function readRetryCount(amqpMsg: AmqpMessageLike): number {
  const raw = amqpMsg?.properties?.headers?.[RETRY_COUNT_HEADER];
  const attempt = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(attempt) && attempt > 0 ? attempt : 0;
}
