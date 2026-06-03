import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import { DuplicateMessageError } from "../../application/errors/duplicate-message.error";
import { WalletNotFoundError } from "../../application/errors/wallet-not-found.error";
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
    await this.prisma.$transaction(async (tx) => {
      await this.recordKey(tx, { messageKey, type });
      for (const message of outbox) {
        await tx.outboxMessage.create({ data: toCreateData(message) });
      }
    });
  }

  async recordDebit({
    messageKey,
    type,
    playerId,
    stakeCents,
    confirmReply,
    rejectReply,
  }: {
    messageKey: string;
    type: string;
    playerId: string;
    stakeCents: number;
    confirmReply: NewOutboxMessage;
    rejectReply: NewOutboxMessage;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.recordKey(tx, { messageKey, type });

      // Conditional UPDATE with a row lock: the `gte` guard is the balance-never-negative invariant
      // at the row, and it makes concurrent debits on the same wallet safe.
      const amount = BigInt(stakeCents);
      const { count } = await tx.wallet.updateMany({
        where: { playerId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (count > 0) {
        await tx.outboxMessage.create({ data: toCreateData(confirmReply) });
        return;
      }

      // No row debited: a missing wallet is an anomaly (throw, so it retries/dead-letters);
      // insufficient funds is a normal outcome, so enqueue the rejection reply in this transaction.
      const wallet = await tx.wallet.findUnique({
        where: { playerId },
        select: { playerId: true },
      });
      if (!wallet) {
        throw new WalletNotFoundError();
      }
      await tx.outboxMessage.create({ data: toCreateData(rejectReply) });
    });
  }

  async recordCredit({
    messageKey,
    type,
    playerId,
    amountCents,
  }: {
    messageKey: string;
    type: string;
    playerId: string;
    amountCents: number;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.recordKey(tx, { messageKey, type });

      // Credit unconditionally (ADR-0001) — no balance guard. The increment's row lock keeps
      // concurrent credits/debits on the same wallet safe.
      const { count } = await tx.wallet.updateMany({
        where: { playerId },
        data: { balance: { increment: BigInt(amountCents) } },
      });
      if (count === 0) {
        throw new WalletNotFoundError();
      }
    });
  }

  // Scope the duplicate check to this insert so a unique-constraint failure elsewhere in the
  // transaction (a real anomaly) propagates instead of being mistaken for a redelivery.
  private async recordKey(
    tx: Prisma.TransactionClient,
    { messageKey, type }: { messageKey: string; type: string },
  ): Promise<void> {
    try {
      await tx.inboxMessage.create({ data: { messageKey, type } });
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
