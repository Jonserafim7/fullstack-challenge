import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { Module } from "@nestjs/common";
import { DeadLetterRoutingKey, Exchange, Queue } from "@crash/messaging";
import { CreditWalletUseCase } from "../../application/use-cases/credit-wallet.use-case";
import { DebitWalletUseCase } from "../../application/use-cases/debit-wallet.use-case";
import { ProcessInboundMessageUseCase } from "../../application/use-cases/process-inbound-message.use-case";
import { EnvModule } from "../env/env.module";
import { EnvService } from "../env/env.service";
import { DatabaseModule } from "../persistence/database.module";
import { OutboxRelay } from "./outbox-relay";
import { WalletsInboxConsumer } from "./wallets-inbox.consumer";

// Wires wallets into RabbitMQ (ADR-0008): asserts the shared crash.events + crash.dlx exchanges
// and the wallets dead-letter queue, runs the outbox relay, and hosts the inbox consumer that
// applies inbound messages exactly once. Each service asserts the topology it touches.
@Module({
  imports: [
    EnvModule,
    DatabaseModule,
    RabbitMQModule.forRootAsync({
      imports: [EnvModule],
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        uri: env.get("RABBITMQ_URL"),
        exchanges: [
          { name: Exchange.EVENTS, type: "topic", options: { durable: true } },
          {
            name: Exchange.DEAD_LETTER,
            type: "topic",
            options: { durable: true },
          },
        ],
        queues: [
          {
            name: Queue.WALLETS_DLQ,
            exchange: Exchange.DEAD_LETTER,
            routingKey: DeadLetterRoutingKey.WALLETS,
            options: { durable: true },
          },
        ],
        defaultPublishOptions: { persistent: true },
        connectionInitOptions: { wait: true, timeout: 20000 },
      }),
    }),
  ],
  providers: [
    OutboxRelay,
    WalletsInboxConsumer,
    ProcessInboundMessageUseCase,
    DebitWalletUseCase,
    CreditWalletUseCase,
  ],
})
export class MessagingModule {}
