import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { Module } from "@nestjs/common";
import {
  DeadLetterRoutingKey,
  Exchange,
  Queue,
  RoutingKey,
} from "@crash/messaging";
import { CreditWalletUseCase } from "../../application/use-cases/credit-wallet.use-case";
import { DebitWalletUseCase } from "../../application/use-cases/debit-wallet.use-case";
import { EnvModule } from "../env/env.module";
import { EnvService } from "../env/env.service";
import { DatabaseModule } from "../persistence/database.module";
import { OutboxRelay } from "./outbox-relay";
import { WalletsInboxConsumer } from "./wallets-inbox.consumer";

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
          // Delay queue: messages expire here and are dead-lettered back to crash.events under redeliver.wallets. Never consumed directly.
          {
            name: Queue.WALLETS_RETRY,
            exchange: Exchange.EVENTS,
            routingKey: RoutingKey.RETRY_WALLETS,
            options: {
              durable: true,
              arguments: {
                "x-dead-letter-exchange": Exchange.EVENTS,
                "x-dead-letter-routing-key": RoutingKey.REDELIVER_WALLETS,
              },
            },
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
    DebitWalletUseCase,
    CreditWalletUseCase,
  ],
})
export class MessagingModule {}
