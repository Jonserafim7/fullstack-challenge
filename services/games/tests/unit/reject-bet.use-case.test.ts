import { describe, test, expect } from "bun:test";
import { Money } from "@crash/money";
import {
  debitRejectedKey,
  DebitRejectionReason,
  MessageType,
  type DebitRejectedPayload,
  type MessageEnvelope,
} from "@crash/messaging";
import { DuplicateMessageError } from "../../src/application/errors/duplicate-message.error";
import type { InboxStore } from "../../src/application/messaging/inbox-store";
import type {
  BetRejectedEvent,
  RoundEventPublisher,
} from "../../src/application/realtime/round-event-publisher";
import { Bet } from "../../src/domain/entities/bet";
import { RejectBetUseCase } from "../../src/application/use-cases/reject-bet.use-case";

function rejectedBet(): Bet {
  const bet = Bet.place({
    betId: "bet-1",
    roundNumber: 7,
    playerId: "player-9",
    username: "p",
    stake: Money.fromCents(500),
  });
  bet.reject();
  return bet;
}

function buildHarness(recordResult: Bet | null | "duplicate") {
  const events: BetRejectedEvent[] = [];
  const calls: { messageKey: string; betId: string }[] = [];
  const inbox = {
    recordRejection: async ({
      messageKey,
      betId,
    }: {
      messageKey: string;
      betId: string;
    }): Promise<Bet | null> => {
      calls.push({ messageKey, betId });
      if (recordResult === "duplicate") {
        throw new DuplicateMessageError(messageKey);
      }
      return recordResult;
    },
  } as unknown as InboxStore;
  const publisher = {
    betRejected: (event: BetRejectedEvent) => events.push(event),
  } as unknown as RoundEventPublisher;
  return { useCase: new RejectBetUseCase(inbox, publisher), events, calls };
}

function rejection(betId: string): MessageEnvelope<DebitRejectedPayload> {
  return {
    messageKey: debitRejectedKey(betId),
    type: MessageType.BET_DEBIT_REJECTED,
    payload: {
      betId,
      playerId: "player-9",
      reason: DebitRejectionReason.INSUFFICIENT_BALANCE,
    },
    occurredAt: new Date().toISOString(),
  };
}

describe("RejectBet", () => {
  test("marks the Bet Rejected and notifies its owner privately", async () => {
    const { useCase, events } = buildHarness(rejectedBet());

    await useCase.handle(rejection("bet-1"));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      betId: "bet-1",
      roundNumber: 7,
      playerId: "player-9",
      reason: DebitRejectionReason.INSUFFICIENT_BALANCE,
    });
  });

  test("notifies no one when the Bet is missing or no longer Pending", async () => {
    const { useCase, events } = buildHarness(null);

    await useCase.handle(rejection("bet-1"));

    expect(events).toHaveLength(0);
  });

  test("ignores a redelivered rejection without notifying again", async () => {
    const { useCase, events, calls } = buildHarness("duplicate");
    const envelope = rejection("bet-1");

    await useCase.handle(envelope);
    await useCase.handle(envelope);

    expect(calls).toHaveLength(2);
    expect(events).toHaveLength(0);
  });
});
