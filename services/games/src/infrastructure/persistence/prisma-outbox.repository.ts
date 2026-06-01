import { Injectable } from "@nestjs/common";
import { RoutingKey } from "@crash/messaging";
import { Prisma } from "../../../generated/prisma/client";
import {
  NewOutboxMessage,
  OutboxStatus,
  OutboxStore,
  PendingOutboxMessage,
} from "../../application/messaging/outbox-store";
import { PrismaService } from "./prisma.service";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

@Injectable()
export class PrismaOutboxRepository implements OutboxStore {
  constructor(private readonly prisma: PrismaService) {}

  // Idempotent on the message key: enqueuing the same deterministic key twice (a replayed
  // request, a retried command) is a no-op rather than a crash. message_key is the only unique
  // column besides the cuid primary key, so any P2002 here means the message is already enqueued.
  async enqueue(message: NewOutboxMessage): Promise<void> {
    try {
      await this.prisma.outboxMessage.create({ data: toCreateData(message) });
    } catch (error) {
      if (isDuplicateKey(error)) {
        return;
      }
      throw error;
    }
  }

  async findPending({
    limit,
    maxAttempts,
  }: {
    limit: number;
    maxAttempts: number;
  }): Promise<PendingOutboxMessage[]> {
    const rows = await this.prisma.outboxMessage.findMany({
      // Most rows give up after maxAttempts so a poison message stops draining. Payout credits are
      // the exception: ADR-0001 makes credits unconditional and never abandoned, so a stuck payout
      // keeps retrying forever (a slow/down wallets only delays it). The debit command still caps.
      where: {
        status: OutboxStatus.PENDING,
        OR: [
          { attempts: { lt: maxAttempts } },
          { routingKey: RoutingKey.WALLET_PAYOUT },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      messageKey: row.messageKey,
      type: row.type,
      routingKey: row.routingKey,
      payload: row.payload,
      occurredAt: row.createdAt,
    }));
  }

  async markPublished(id: string): Promise<void> {
    await this.prisma.outboxMessage.update({
      where: { id },
      data: { status: OutboxStatus.PUBLISHED, publishedAt: new Date() },
    });
  }

  async markFailed(id: string): Promise<void> {
    await this.prisma.outboxMessage.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }
}

function isDuplicateKey(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  );
}

function toCreateData(
  message: NewOutboxMessage,
): Prisma.OutboxMessageCreateInput {
  return {
    messageKey: message.messageKey,
    type: message.type,
    routingKey: message.routingKey,
    payload: message.payload as Prisma.InputJsonValue,
  };
}
