import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { Module } from "@nestjs/common";
import {
  DeadLetterRoutingKey,
  Exchange,
  Queue,
  RoutingKey,
} from "@crash/messaging";
import { ConfirmBetUseCase } from "../../application/use-cases/confirm-bet.use-case";
import { RejectBetUseCase } from "../../application/use-cases/reject-bet.use-case";
import { EnvModule } from "../env/env.module";
import { EnvService } from "../env/env.service";
import { DatabaseModule } from "../persistence/database.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { GamesInboxConsumer } from "./games-inbox.consumer";
import { OutboxRelay } from "./outbox-relay";

@Module({
  imports: [
    EnvModule,
    DatabaseModule,
    RealtimeModule,
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
            name: Queue.GAMES_DLQ,
            exchange: Exchange.DEAD_LETTER,
            routingKey: DeadLetterRoutingKey.GAMES,
            options: { durable: true },
          },
          // Never consumed directly: TTL expires → dead-letters back to crash.events as `redeliver.games`.
          {
            name: Queue.GAMES_RETRY,
            exchange: Exchange.EVENTS,
            routingKey: RoutingKey.RETRY_GAMES,
            options: {
              durable: true,
              arguments: {
                "x-dead-letter-exchange": Exchange.EVENTS,
                "x-dead-letter-routing-key": RoutingKey.REDELIVER_GAMES,
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
    GamesInboxConsumer,
    ConfirmBetUseCase,
    RejectBetUseCase,
  ],
})
export class MessagingModule {}
