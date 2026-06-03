import { describe, expect, test } from "bun:test";
import {
  debitConfirmedKey,
  debitKey,
  debitRejectedKey,
  DebitRejectionReason,
  MessageType,
  RoutingKey,
  type DebitCommandPayload,
  type DebitRejectedPayload,
  type MessageEnvelope,
} from "@crash/messaging";
import { DuplicateMessageError } from "../../src/application/errors/duplicate-message.error";
import type { InboxStore } from "../../src/application/messaging/inbox-store";
import type { NewOutboxMessage } from "../../src/application/messaging/outbox-store";
import { DebitWalletUseCase } from "../../src/application/use-cases/debit-wallet.use-case";

interface RecordedDebit {
  messageKey: string;
  playerId: string;
  stakeCents: number;
  confirmReply: NewOutboxMessage;
  rejectReply: NewOutboxMessage;
}

// Throws DuplicateMessageError on a repeated key, mimicking the DB P2002 primary-key dedup.
function buildInbox(): { inbox: InboxStore; debits: RecordedDebit[] } {
  const seenKeys = new Set<string>();
  const debits: RecordedDebit[] = [];
  const inbox = {
    recordDebit: async ({
      messageKey,
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
    }): Promise<void> => {
      if (seenKeys.has(messageKey)) {
        throw new DuplicateMessageError(messageKey);
      }
      seenKeys.add(messageKey);
      debits.push({
        messageKey,
        playerId,
        stakeCents,
        confirmReply,
        rejectReply,
      });
    },
  } as InboxStore;
  return { inbox, debits };
}

function debitCommand(betId: string): MessageEnvelope<DebitCommandPayload> {
  return {
    messageKey: debitKey(betId),
    type: MessageType.WALLET_DEBIT,
    payload: { betId, playerId: "player-1", stakeCents: 500 },
    occurredAt: new Date().toISOString(),
  };
}

describe("DebitWallet (inbox dedup)", () => {
  test("applies a debit once, handing down both the confirmation and rejection replies", async () => {
    const { inbox, debits } = buildInbox();
    const useCase = new DebitWalletUseCase(inbox);

    await useCase.handle(debitCommand("bet-1"));

    expect(debits).toHaveLength(1);
    expect(debits[0]?.playerId).toBe("player-1");
    expect(debits[0]?.stakeCents).toBe(500);

    const confirm = debits[0]?.confirmReply;
    expect(confirm?.messageKey).toBe(debitConfirmedKey("bet-1"));
    expect(confirm?.routingKey).toBe(RoutingKey.BET_DEBIT_CONFIRMED);
    expect((confirm?.payload as { betId: string }).betId).toBe("bet-1");

    const reject = debits[0]?.rejectReply;
    expect(reject?.messageKey).toBe(debitRejectedKey("bet-1"));
    expect(reject?.routingKey).toBe(RoutingKey.BET_DEBIT_REJECTED);
    const rejectPayload = reject?.payload as DebitRejectedPayload;
    expect(rejectPayload.betId).toBe("bet-1");
    expect(rejectPayload.playerId).toBe("player-1");
    expect(rejectPayload.reason).toBe(
      DebitRejectionReason.INSUFFICIENT_BALANCE,
    );
  });

  test("ignores a redelivered debit with the same key, moving money once", async () => {
    const { inbox, debits } = buildInbox();
    const useCase = new DebitWalletUseCase(inbox);
    const command = debitCommand("bet-1");

    await useCase.handle(command);
    await useCase.handle(command);

    expect(debits).toHaveLength(1);
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
