import { describe, expect, test } from "bun:test";
import {
  MessageType,
  payoutKey,
  type MessageEnvelope,
  type PayoutCommandPayload,
} from "@crash/messaging";
import { DuplicateMessageError } from "../../src/application/errors/duplicate-message.error";
import type { InboxStore } from "../../src/application/messaging/inbox-store";
import { CreditWalletUseCase } from "../../src/application/use-cases/credit-wallet.use-case";

interface RecordedCredit {
  messageKey: string;
  playerId: string;
  amountCents: number;
}

// Throws DuplicateMessageError on a repeated key, mimicking the DB P2002 primary-key dedup.
function buildInbox(): { inbox: InboxStore; credits: RecordedCredit[] } {
  const seenKeys = new Set<string>();
  const credits: RecordedCredit[] = [];
  const inbox = {
    recordCredit: async ({
      messageKey,
      playerId,
      amountCents,
    }: {
      messageKey: string;
      type: string;
      playerId: string;
      amountCents: number;
    }): Promise<void> => {
      if (seenKeys.has(messageKey)) {
        throw new DuplicateMessageError(messageKey);
      }
      seenKeys.add(messageKey);
      credits.push({ messageKey, playerId, amountCents });
    },
  } as InboxStore;
  return { inbox, credits };
}

function payoutCommand(betId: string): MessageEnvelope<PayoutCommandPayload> {
  return {
    messageKey: payoutKey(betId),
    type: MessageType.WALLET_PAYOUT,
    payload: { betId, playerId: "player-1", amountCents: 1235 },
    occurredAt: new Date().toISOString(),
  };
}

describe("CreditWallet (inbox dedup)", () => {
  test("applies a payout credit once", async () => {
    const { inbox, credits } = buildInbox();
    const useCase = new CreditWalletUseCase(inbox);

    await useCase.handle(payoutCommand("bet-1"));

    expect(credits).toHaveLength(1);
    expect(credits[0]?.playerId).toBe("player-1");
    expect(credits[0]?.amountCents).toBe(1235);
    expect(credits[0]?.messageKey).toBe(payoutKey("bet-1"));
  });

  test("ignores a redelivered payout with the same key, crediting once", async () => {
    const { inbox, credits } = buildInbox();
    const useCase = new CreditWalletUseCase(inbox);
    const command = payoutCommand("bet-1");

    await useCase.handle(command);
    await useCase.handle(command);

    expect(credits).toHaveLength(1);
  });

  test("propagates unexpected errors instead of swallowing them", async () => {
    const failingInbox = {
      recordCredit: async (): Promise<void> => {
        throw new Error("database unreachable");
      },
    } as unknown as InboxStore;
    const useCase = new CreditWalletUseCase(failingInbox);

    await expect(useCase.handle(payoutCommand("bet-1"))).rejects.toThrow(
      "database unreachable",
    );
  });
});
