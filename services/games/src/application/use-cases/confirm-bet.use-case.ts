import { Injectable, Logger } from "@nestjs/common";
import {
  type DebitConfirmedPayload,
  type MessageEnvelope,
} from "@crash/messaging";
import { DuplicateMessageError } from "../errors/duplicate-message.error";
import { InboxStore } from "../messaging/inbox-store";
import { RoundEventPublisher } from "../realtime/round-event-publisher";

// Applies a `bet.debit-confirmed` reply exactly once (ADR-0001): the inbox marks the Bet Confirmed
// and records the dedup key in one transaction; a redelivery hits the inbox primary key, surfaces
// as DuplicateMessageError, and is swallowed as a no-op. Only after the transition commits does it
// broadcast `bet.confirmed` — the broadcast is best-effort (clients can re-hydrate over REST), so
// it stays outside the transaction.
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
      const bet = await this.inbox.recordConfirmation({
        messageKey: envelope.messageKey,
        type: envelope.type,
        betId,
      });
      if (bet) {
        this.publisher.betConfirmed({
          betId: bet.betId,
          roundNumber: bet.roundNumber,
          username: bet.username,
          amountCents: Number(bet.stake.cents),
        });
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
}
