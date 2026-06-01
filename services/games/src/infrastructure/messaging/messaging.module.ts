import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { Module } from "@nestjs/common";
import { DeadLetterRoutingKey, Exchange, Queue } from "@crash/messaging";
import { EnvModule } from "../env/env.module";
import { EnvService } from "../env/env.service";
import { DatabaseModule } from "../persistence/database.module";
import { OutboxRelay } from "./outbox-relay";
import { SmokeReplyConsumer } from "./smoke-reply.consumer";

// Wires games into RabbitMQ (ADR-0008): asserts the shared crash.events + crash.dlx exchanges
// and the games dead-letter queue, runs the outbox relay, and hosts the smoke-pong consumer.
// Each service asserts the topology it touches, so neither service must boot first.
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
            name: Queue.GAMES_DLQ,
            exchange: Exchange.DEAD_LETTER,
            routingKey: DeadLetterRoutingKey.GAMES,
            options: { durable: true },
          },
        ],
        defaultPublishOptions: { persistent: true },
        connectionInitOptions: { wait: true, timeout: 20000 },
      }),
    }),
  ],
  providers: [OutboxRelay, SmokeReplyConsumer],
})
export class MessagingModule {}
