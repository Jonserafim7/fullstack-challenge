import { Nack, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, Logger } from "@nestjs/common";
import {
  DeadLetterRoutingKey,
  Exchange,
  MessageType,
  Queue,
  RoutingKey,
  type MessageEnvelope,
} from "@crash/messaging";
import { CreditWalletUseCase } from "../../application/use-cases/credit-wallet.use-case";
import { DebitWalletUseCase } from "../../application/use-cases/debit-wallet.use-case";
import { ProcessInboundMessageUseCase } from "../../application/use-cases/process-inbound-message.use-case";

// The single consumer on wallets.inbox. It binds every routing key wallets must act on and
// dispatches by message type — one consumer per queue, because two consumers on the same queue
// would compete and a debit could be delivered to the smoke handler (AMQP routes to the queue,
// then round-robins its consumers regardless of routing key). A successful (or already-seen,
// deduplicated) message acks; an unexpected failure nacks without requeue, dead-lettering to
// crash.dlx (ADR-0001's poison-message path).
@Injectable()
export class WalletsInboxConsumer {
  private readonly logger = new Logger(WalletsInboxConsumer.name);

  constructor(
    private readonly processInbound: ProcessInboundMessageUseCase,
    private readonly debitWallet: DebitWalletUseCase,
    private readonly creditWallet: CreditWalletUseCase,
  ) {}

  @RabbitSubscribe({
    exchange: Exchange.EVENTS,
    routingKey: [
      RoutingKey.SMOKE_PING,
      RoutingKey.WALLET_DEBIT,
      RoutingKey.WALLET_PAYOUT,
    ],
    queue: Queue.WALLETS_INBOX,
    queueOptions: {
      durable: true,
      deadLetterExchange: Exchange.DEAD_LETTER,
      deadLetterRoutingKey: DeadLetterRoutingKey.WALLETS,
    },
  })
  async onMessage(envelope: MessageEnvelope): Promise<Nack | undefined> {
    try {
      await this.dispatch(envelope);
      return undefined;
    } catch (error) {
      this.logger.error(
        `Failed to process inbound message ${envelope?.messageKey}`,
        error,
      );
      return new Nack(false);
    }
  }

  private async dispatch(envelope: MessageEnvelope): Promise<void> {
    switch (envelope.type) {
      case MessageType.WALLET_DEBIT:
        return this.debitWallet.handle(envelope);
      case MessageType.WALLET_PAYOUT:
        return this.creditWallet.handle(envelope);
      case MessageType.SMOKE_PING:
        return this.processInbound.handle(envelope);
      default:
        this.logger.warn(`Ignoring message of unknown type ${envelope.type}`);
        return;
    }
  }
}
