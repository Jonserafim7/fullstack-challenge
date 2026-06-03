import { describe, test, expect } from "bun:test";
import { Money } from "@crash/money";
import {
  debitConfirmedKey,
  MessageType,
  refundKey,
  RoutingKey,
  type DebitConfirmedPayload,
  type MessageEnvelope,
  type RefundCommandPayload,
} from "@crash/messaging";
import { DuplicateMessageError } from "../../src/application/errors/duplicate-message.error";
import type {
  ConfirmationResult,
  InboxStore,
  RefundableBet,
} from "../../src/application/messaging/inbox-store";
import type { NewOutboxMessage } from "../../src/application/messaging/outbox-store";
import type {
  BetConfirmedEvent,
  RoundEventPublisher,
} from "../../src/application/realtime/round-event-publisher";
import { Bet } from "../../src/domain/entities/bet";
import { ConfirmBetUseCase } from "../../src/application/use-cases/confirm-bet.use-case";

function confirmedBet(): Bet {
  const bet = Bet.place({
    betId: "bet-1",
    roundNumber: 7,
    playerId: "player-9",
    username: "winner",
    stake: Money.fromCents(500),
  });
  bet.confirm({ confirmedAt: new Date() });
  return bet;
}

function buildHarness(
  decide: (
    buildRefund: (bet: RefundableBet) => NewOutboxMessage,
  ) => ConfirmationResult | "duplicate",
) {
  const confirmedEvents: BetConfirmedEvent[] = [];
  let refund: NewOutboxMessage | null = null;
  const inbox = {
    recordConfirmation: async ({
      messageKey,
      buildRefund,
    }: {
      messageKey: string;
      buildRefund: (bet: RefundableBet) => NewOutboxMessage;
    }): Promise<ConfirmationResult> => {
      const captureRefund = (bet: RefundableBet): NewOutboxMessage => {
        refund = buildRefund(bet);
        return refund;
      };
      const result = decide(captureRefund);
      if (result === "duplicate") {
        throw new DuplicateMessageError(messageKey);
      }
      return result;
    },
  } as unknown as InboxStore;
  const publisher = {
    betConfirmed: (event: BetConfirmedEvent) => confirmedEvents.push(event),
  } as unknown as RoundEventPublisher;
  return {
    useCase: new ConfirmBetUseCase(inbox, publisher),
    confirmedEvents,
    getRefund: () => refund,
  };
}

function confirmation(betId: string): MessageEnvelope<DebitConfirmedPayload> {
  return {
    messageKey: debitConfirmedKey(betId),
    type: MessageType.BET_DEBIT_CONFIRMED,
    payload: { betId },
    occurredAt: new Date().toISOString(),
  };
}

describe("ConfirmBet", () => {
  test("broadcasts bet.confirmed when a Pending bet is Confirmed", async () => {
    const { useCase, confirmedEvents, getRefund } = buildHarness(() => ({
      kind: "confirmed",
      bet: confirmedBet(),
    }));

    await useCase.handle(confirmation("bet-1"));

    expect(confirmedEvents).toHaveLength(1);
    expect(confirmedEvents[0]).toMatchObject({
      betId: "bet-1",
      roundNumber: 7,
      username: "winner",
      amountCents: 500,
    });
    expect(getRefund()).toBeNull();
  });

  test("enqueues exactly one refund for a Voided bet's late confirmation", async () => {
    const { useCase, confirmedEvents, getRefund } = buildHarness(
      (buildRefund) => {
        buildRefund({ betId: "bet-1", playerId: "player-9", stakeCents: 500 });
        return { kind: "refunded", betId: "bet-1" };
      },
    );

    await useCase.handle(confirmation("bet-1"));

    const refund = getRefund();
    expect(refund?.messageKey).toBe(refundKey("bet-1"));
    expect(refund?.routingKey).toBe(RoutingKey.WALLET_REFUND);
    expect(refund?.payload as RefundCommandPayload).toEqual({
      betId: "bet-1",
      playerId: "player-9",
      amountCents: 500,
    });
    expect(confirmedEvents).toHaveLength(0);
  });

  test("ignores a redelivered confirmation without broadcasting", async () => {
    const { useCase, confirmedEvents } = buildHarness(() => "duplicate");
    const envelope = confirmation("bet-1");

    await useCase.handle(envelope);
    await useCase.handle(envelope);

    expect(confirmedEvents).toHaveLength(0);
  });
});
