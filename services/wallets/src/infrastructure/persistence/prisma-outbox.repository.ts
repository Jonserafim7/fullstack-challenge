import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import {
  NewOutboxMessage,
  OutboxStatus,
  OutboxStore,
  PendingOutboxMessage,
} from "../../application/messaging/outbox-store";
import { PrismaService } from "./prisma.service";

@Injectable()
export class PrismaOutboxRepository implements OutboxStore {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(message: NewOutboxMessage): Promise<void> {
    await this.prisma.outboxMessage.create({ data: toCreateData(message) });
  }

  async findPending({
    limit,
    maxAttempts,
  }: {
    limit: number;
    maxAttempts: number;
  }): Promise<PendingOutboxMessage[]> {
    const rows = await this.prisma.outboxMessage.findMany({
      where: { status: OutboxStatus.PENDING, attempts: { lt: maxAttempts } },
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
