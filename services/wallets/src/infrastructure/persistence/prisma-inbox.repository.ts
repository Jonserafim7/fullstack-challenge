import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import { DuplicateMessageError } from "../../application/errors/duplicate-message.error";
import { WalletNotFoundError } from "../../application/errors/wallet-not-found.error";
import { InboxStore } from "../../application/messaging/inbox-store";
import { NewOutboxMessage } from "../../application/messaging/outbox-store";
import { InsufficientBalanceError } from "../../domain/errors/insufficient-balance.error";
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
    reply,
  }: {
    messageKey: string;
    type: string;
    playerId: string;
    stakeCents: number;
    reply: NewOutboxMessage;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.recordKey(tx, { messageKey, type });

      // Debit atomically so concurrent debits on the same wallet cannot lose an update: the
      // conditional UPDATE takes a row lock and re-checks the balance, and the `gte` guard is the
      // balance-never-negative invariant enforced at the row. A redelivery of the same betId is
      // already a no-op via the inbox key above; this guards the distinct-betId same-wallet race.
      const amount = BigInt(stakeCents);
      const { count } = await tx.wallet.updateMany({
        where: { playerId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (count === 0) {
        const exists = await tx.wallet.findUnique({
          where: { playerId },
          select: { playerId: true },
        });
        throw exists
          ? new InsufficientBalanceError()
          : new WalletNotFoundError();
      }

      await tx.outboxMessage.create({ data: toCreateData(reply) });
    });
  }

  // The dedup is the inbox primary key alone. Scoping the duplicate check to this insert means a
  // unique-constraint failure elsewhere in the transaction (a real anomaly) propagates instead of
  // being mistaken for a redelivery and silently swallowed.
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
