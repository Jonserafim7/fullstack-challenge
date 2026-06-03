import { describe, expect, test } from "bun:test";
import {
  debitKey,
  MessageType,
  type DebitCommandPayload,
  type MessageEnvelope,
} from "@crash/messaging";
import { DuplicateMessageError } from "../../src/application/errors/duplicate-message.error";
import type { InboxStore } from "../../src/application/messaging/inbox-store";
import { DebitWalletUseCase } from "../../src/application/use-cases/debit-wallet.use-case";

// Throws DuplicateMessageError on a repeated key, mimicking the DB P2002 primary-key dedup.
function buildInbox(): { inbox: InboxStore; recordedKeys: string[] } {
  const seenKeys = new Set<string>();
  const recordedKeys: string[] = [];
  const inbox = {
    recordDebit: async ({
      messageKey,
    }: {
      messageKey: string;
    }): Promise<void> => {
      if (seenKeys.has(messageKey)) {
        throw new DuplicateMessageError(messageKey);
      }
      seenKeys.add(messageKey);
      recordedKeys.push(messageKey);
    },
  } as unknown as InboxStore;
  return { inbox, recordedKeys };
}

function debitCommand(betId: string): MessageEnvelope {
  const payload: DebitCommandPayload = {
    betId,
    playerId: "player-1",
    stakeCents: 1_000,
  };
  return {
    messageKey: debitKey(betId),
    type: MessageType.WALLET_DEBIT,
    payload,
    occurredAt: new Date().toISOString(),
  };
}

describe("DebitWallet (inbox dedup)", () => {
  test("applies a debit once", async () => {
    const { inbox, recordedKeys } = buildInbox();
    const useCase = new DebitWalletUseCase(inbox);

    await useCase.handle(debitCommand("bet-1"));

    expect(recordedKeys).toEqual([debitKey("bet-1")]);
  });

  test("ignores a redelivered debit with the same key, moving money once", async () => {
    const { inbox, recordedKeys } = buildInbox();
    const useCase = new DebitWalletUseCase(inbox);
    const command = debitCommand("bet-1");

    await useCase.handle(command);
    await useCase.handle(command);

    expect(recordedKeys).toHaveLength(1);
  });

  test("propagates unexpected errors instead of swallowing them", async () => {
    const failingInbox = {
      recordDebit: async (): Promise<void> => {
        throw new Error("database unreachable");
      },
    } as unknown as InboxStore;
    const useCase = new DebitWalletUseCase(failingInbox);

    await expect(useCase.handle(debitCommand("bet-1"))).rejects.toThrow(
      "database unreachable",
    );
  });
});
