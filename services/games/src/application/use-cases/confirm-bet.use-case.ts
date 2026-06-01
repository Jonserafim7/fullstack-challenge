import { Injectable, Logger } from "@nestjs/common";
import {
  MessageType,
  refundKey,
  RoutingKey,
  type DebitConfirmedPayload,
  type MessageEnvelope,
  type RefundCommandPayload,
} from "@crash/messaging";
import { DuplicateMessageError } from "../errors/duplicate-message.error";
import { InboxStore, RefundableBet } from "../messaging/inbox-store";
import { NewOutboxMessage } from "../messaging/outbox-store";
import { RoundEventPublisher } from "../realtime/round-event-publisher";

// Applies a `bet.debit-confirmed` reply exactly once (ADR-0001): the inbox marks the Bet Confirmed
// and records the dedup key in one transaction; a redelivery hits the inbox primary key, surfaces
// as DuplicateMessageError, and is swallowed as a no-op. If the Bet was already Voided (its betting
// window closed before this debit landed) the same transaction instead enqueues a compensating
// Refund. Only after a confirmation commits does it broadcast `bet.confirmed` — best-effort, so it
// stays outside the transaction (clients can re-hydrate over REST).
@Injectable()
export class ConfirmBetUseCase {
  private readonly logger = new Logger(ConfirmBetUseCase.name);

  constructor(
    private readonly inbox: InboxStore,
    private readonly publisher: RoundEventPublisher,
  ) {}

  async handle(envelope: MessageEnvelope): Promise<void> {
    const { betId } = envelope.payload as DebitConfirmedPayload;
    try {
      const result = await this.inbox.recordConfirmation({
        messageKey: envelope.messageKey,
        type: envelope.type,
        betId,
        buildRefund: (bet) => this.refundCommand(bet),
      });
      if (result.kind === "confirmed") {
        const { bet } = result;
        this.publisher.betConfirmed({
          betId: bet.betId,
          roundNumber: bet.roundNumber,
          username: bet.username,
          amountCents: Number(bet.stake.cents),
        });
      } else if (result.kind === "refunded") {
        this.logger.log(
          `Refund enqueued for voided bet ${result.betId} whose debit landed late`,
        );
      }
    } catch (error) {
      if (error instanceof DuplicateMessageError) {
        this.logger.debug(
          `Ignoring redelivered confirmation ${envelope.messageKey}`,
        );
        return;
      }
      throw error;
    }
  }

  private refundCommand({
    betId,
    playerId,
    stakeCents,
  }: RefundableBet): NewOutboxMessage {
    const payload: RefundCommandPayload = {
      betId,
      playerId,
      amountCents: stakeCents,
    };
    return {
      messageKey: refundKey(betId),
      type: MessageType.WALLET_REFUND,
      routingKey: RoutingKey.WALLET_REFUND,
      payload,
    };
  }
}
