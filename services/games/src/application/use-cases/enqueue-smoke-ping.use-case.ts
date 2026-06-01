import { Injectable } from "@nestjs/common";
import {
  MessageType,
  RoutingKey,
  smokePingKey,
  type SmokePayload,
} from "@crash/messaging";
import { OutboxStore } from "../messaging/outbox-store";

// Drives the #6 smoke round-trip from games: enqueues a ping into the outbox. The relay publishes
// it, wallets replies with a pong, and games logs the completed loop — proving the broker path
// end-to-end before any real Bet exists. This is the only thing on the path that is smoke-specific.
@Injectable()
export class EnqueueSmokePingUseCase {
  constructor(private readonly outbox: OutboxStore) {}

  async execute(correlationId: string): Promise<void> {
    const payload: SmokePayload = { correlationId };
    await this.outbox.enqueue({
      messageKey: smokePingKey(correlationId),
      type: MessageType.SMOKE_PING,
      routingKey: RoutingKey.SMOKE_PING,
      payload,
    });
  }
}
