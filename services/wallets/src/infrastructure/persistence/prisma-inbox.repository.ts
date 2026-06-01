import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import { DuplicateMessageError } from "../../application/errors/duplicate-message.error";
import { InboxStore } from "../../application/messaging/inbox-store";
import { NewOutboxMessage } from "../../application/messaging/outbox-store";
import { PrismaService } from "./prisma.service";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

@Injectable()
export class PrismaInboxRepository implements InboxStore {
  constructor(private readonly prisma: PrismaService) {}

  async recordAndEnqueue({
    messageKey,
    type,
    outbox,
  }: {
    messageKey: string;
    type: string;
    outbox: NewOutboxMessage[];
  }): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.inboxMessage.create({ data: { messageKey, type } });
        for (const message of outbox) {
          await tx.outboxMessage.create({ data: toCreateData(message) });
        }
      });
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new DuplicateMessageError(messageKey);
      }
      throw error;
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
