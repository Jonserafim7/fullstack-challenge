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
import { CreditWalletUseCase } from "../../application/use-cases/credit-wallet.use-case";
import { DebitWalletUseCase } from "../../application/use-cases/debit-wallet.use-case";
import { EnvService } from "../env/env.service";

// The retry attempt count rides in this header so it survives the delay-queue round trip.
const RETRY_COUNT_HEADER = "x-retry-count";

// Just enough of the raw AMQP message to read the retry header, without depending on amqplib types.
interface AmqpMessageLike {
  properties?: { headers?: Record<string, unknown> | null };
}

// The single consumer on wallets.inbox, dispatching by message type. One consumer per queue: AMQP
// round-robins consumers on a queue regardless of routing key, so a second would receive commands
// meant for this one. A transient failure retries with exponential backoff via the delay queue and,
// once exhausted, dead-letters to crash.dlx (ADR-0001).
@Injectable()
export class WalletsInboxConsumer {
  private readonly logger = new Logger(WalletsInboxConsumer.name);
  private readonly retryBaseMs: number;
  private readonly retryMaxAttempts: number;

  constructor(
    private readonly debitWallet: DebitWalletUseCase,
    private readonly creditWallet: CreditWalletUseCase,
    private readonly amqp: AmqpConnection,
    env: EnvService,
  ) {
    this.retryBaseMs = env.get("INBOX_RETRY_BASE_MS");
    this.retryMaxAttempts = env.get("INBOX_RETRY_MAX_ATTEMPTS");
  }

  @RabbitSubscribe({
    exchange: Exchange.EVENTS,
    routingKey: [
      RoutingKey.WALLET_DEBIT,
      RoutingKey.WALLET_PAYOUT,
      RoutingKey.WALLET_REFUND,
      RoutingKey.REDELIVER_WALLETS,
    ],
    queue: Queue.WALLETS_INBOX,
    queueOptions: {
      durable: true,
      deadLetterExchange: Exchange.DEAD_LETTER,
      deadLetterRoutingKey: DeadLetterRoutingKey.WALLETS,
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

  // A transient failure is parked in the delay queue with an exponentially growing TTL and retried
  // from the inbox when it expires; once the attempts are exhausted the message is poison and is
  // dead-lettered (Nack without requeue). If scheduling the retry itself fails, the message is
  // requeued rather than lost to the DLQ.
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
        RoutingKey.RETRY_WALLETS,
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
      case MessageType.WALLET_DEBIT:
        return this.debitWallet.handle(envelope);
      // Payout and refund are both unconditional credits keyed on the betId, so they share the one
      // credit path; the inbox dedups each on its own key (`payout:` / `refund:`).
      case MessageType.WALLET_PAYOUT:
      case MessageType.WALLET_REFUND:
        return this.creditWallet.handle(envelope);
      default:
        this.logger.warn(`Ignoring message of unknown type ${envelope.type}`);
        return;
    }
  }
}

function readRetryCount(amqpMsg: AmqpMessageLike): number {
  const raw = amqpMsg?.properties?.headers?.[RETRY_COUNT_HEADER];
  const attempt = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(attempt) && attempt > 0 ? attempt : 0;
}
