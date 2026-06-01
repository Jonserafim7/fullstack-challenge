import { Injectable } from "@nestjs/common";
import { CREDIT_ROUTING_KEYS } from "@crash/messaging";
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
      // Most rows give up after maxAttempts so a poison message stops draining. Credits (payout,
      // refund) are the exception: ADR-0001 makes them unconditional and never abandoned, so a stuck
      // credit keeps retrying forever (a slow/down wallets only delays it). Commands and replies cap.
      where: {
        status: OutboxStatus.PENDING,
        OR: [
          { attempts: { lt: maxAttempts } },
          { routingKey: { in: [...CREDIT_ROUTING_KEYS] } },
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

  async markFailed({
    id,
    maxAttempts,
  }: {
    id: string;
    maxAttempts: number;
  }): Promise<void> {
    const row = await this.prisma.outboxMessage.update({
      where: { id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true, routingKey: true },
    });
    // A non-credit row that has now exhausted its attempts is parked FAILED so it stops draining and
    // becomes visible; credits keep retrying forever (ADR-0001), so they are never parked.
    const isCredit = (CREDIT_ROUTING_KEYS as readonly string[]).includes(
      row.routingKey,
    );
    if (!isCredit && row.attempts >= maxAttempts) {
      await this.prisma.outboxMessage.update({
        where: { id },
        data: { status: OutboxStatus.FAILED },
      });
    }
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
