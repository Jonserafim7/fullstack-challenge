import { describe, expect, test } from "bun:test";
import {
  MessageType,
  RoutingKey,
  smokePingKey,
  smokePongKey,
  type MessageEnvelope,
} from "@crash/messaging";
import { DuplicateMessageError } from "../../src/application/errors/duplicate-message.error";
import type { InboxStore } from "../../src/application/messaging/inbox-store";
import type { NewOutboxMessage } from "../../src/application/messaging/outbox-store";
import { ProcessInboundMessageUseCase } from "../../src/application/use-cases/process-inbound-message.use-case";

// A fake inbox that mimics the database primary-key dedup: the first time a key is recorded it
// keeps the enqueued outbox batch; a second attempt with the same key throws DuplicateMessageError,
// exactly as the real Prisma adapter translates a P2002 unique violation.
function buildInbox(): {
  inbox: InboxStore;
  recordedBatches: NewOutboxMessage[][];
} {
  const seenKeys = new Set<string>();
  const recordedBatches: NewOutboxMessage[][] = [];
  const inbox = {
    recordAndEnqueue: async ({
      messageKey,
      outbox,
    }: {
      messageKey: string;
      type: string;
      outbox: NewOutboxMessage[];
    }): Promise<void> => {
      if (seenKeys.has(messageKey)) {
        throw new DuplicateMessageError(messageKey);
      }
      seenKeys.add(messageKey);
      recordedBatches.push(outbox);
    },
  } as InboxStore;
  return { inbox, recordedBatches };
}

function smokePing(correlationId: string): MessageEnvelope {
  return {
    messageKey: smokePingKey(correlationId),
    type: MessageType.SMOKE_PING,
    payload: { correlationId },
    occurredAt: new Date().toISOString(),
  };
}

describe("ProcessInboundMessage (inbox dedup)", () => {
  test("applies a smoke ping once, enqueuing a single pong reply", async () => {
    const { inbox, recordedBatches } = buildInbox();
    const useCase = new ProcessInboundMessageUseCase(inbox);

    await useCase.handle(smokePing("abc"));

    expect(recordedBatches).toHaveLength(1);
    expect(recordedBatches[0]).toHaveLength(1);
    expect(recordedBatches[0]?.[0]?.messageKey).toBe(smokePongKey("abc"));
    expect(recordedBatches[0]?.[0]?.routingKey).toBe(RoutingKey.SMOKE_PONG);
  });

  test("ignores a redelivered ping with the same key, applying no second effect", async () => {
    const { inbox, recordedBatches } = buildInbox();
    const useCase = new ProcessInboundMessageUseCase(inbox);
    const ping = smokePing("abc");

    await useCase.handle(ping);
    await useCase.handle(ping);

    expect(recordedBatches).toHaveLength(1);
  });

  test("propagates unexpected errors instead of swallowing them", async () => {
    const failingInbox = {
      recordAndEnqueue: async (): Promise<void> => {
        throw new Error("database unreachable");
      },
    } as InboxStore;
    const useCase = new ProcessInboundMessageUseCase(failingInbox);

    await expect(useCase.handle(smokePing("abc"))).rejects.toThrow(
      "database unreachable",
    );
  });
});
