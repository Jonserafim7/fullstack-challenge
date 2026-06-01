import { Injectable } from "@nestjs/common";
import { Money } from "@crash/money";
import { Prisma } from "../../../generated/prisma/client";
import { DuplicateMessageError } from "../../application/errors/duplicate-message.error";
import { WalletNotFoundError } from "../../application/errors/wallet-not-found.error";
import { InboxStore } from "../../application/messaging/inbox-store";
import { NewOutboxMessage } from "../../application/messaging/outbox-store";
import { Wallet } from "../../domain/entities/wallet";
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
      this.recordKey(tx, { messageKey, type });
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

      const row = await tx.wallet.findUnique({ where: { playerId } });
      if (!row) {
        throw new WalletNotFoundError();
      }
      // The balance-never-negative invariant stays in the domain: Wallet.debit throws
      // InsufficientBalanceError, which rolls back the whole transaction (key included).
      const wallet = Wallet.create({
        playerId: row.playerId,
        initialBalance: Money.fromCents(row.balance),
      });
      wallet.debit(Money.fromCents(stakeCents));
      await tx.wallet.update({
        where: { playerId },
        data: { balance: wallet.balance.cents },
      });

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
