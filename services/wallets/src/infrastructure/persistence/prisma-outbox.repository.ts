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
      // Credits (payout/refund) are never abandoned and retry forever; all other message types cap at maxAttempts.
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
    const row = await this.prisma.outboxMessage.findUnique({
      where: { id },
      select: { attempts: true, routingKey: true },
    });
    if (!row) {
      return;
    }
    // Increment and FAILED-flip in one update so a crash can't strand the row PENDING at the cap; credits keep retrying forever.
    const attempts = row.attempts + 1;
    const isCredit = (CREDIT_ROUTING_KEYS as readonly string[]).includes(
      row.routingKey,
    );
    const exhausted = !isCredit && attempts >= maxAttempts;
    await this.prisma.outboxMessage.update({
      where: { id },
      data: {
        attempts,
        ...(exhausted ? { status: OutboxStatus.FAILED } : {}),
      },
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
