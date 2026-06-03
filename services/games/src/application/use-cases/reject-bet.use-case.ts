import { Injectable, Logger } from "@nestjs/common";
import {
  type DebitRejectedPayload,
  type MessageEnvelope,
} from "@crash/messaging";
import { DuplicateMessageError } from "../errors/duplicate-message.error";
import { InboxStore } from "../messaging/inbox-store";
import { RoundEventPublisher } from "../realtime/round-event-publisher";

// Applies a bet.debit-rejected reply exactly once (ADR-0001), then notifies the owning player
// privately — the refusal reveals their funds, so it never broadcasts.
@Injectable()
export class RejectBetUseCase {
  private readonly logger = new Logger(RejectBetUseCase.name);

  constructor(
    private readonly inbox: InboxStore,
    private readonly publisher: RoundEventPublisher,
  ) {}

  async handle(envelope: MessageEnvelope): Promise<void> {
    const { betId, reason } = envelope.payload as DebitRejectedPayload;
    try {
      const bet = await this.inbox.recordRejection({
        messageKey: envelope.messageKey,
        type: envelope.type,
        betId,
      });
      if (bet) {
        this.publisher.betRejected({
          betId: bet.betId,
          roundNumber: bet.roundNumber,
          playerId: bet.playerId,
          reason,
        });
      }
    } catch (error) {
      if (error instanceof DuplicateMessageError) {
        this.logger.debug(
          `Ignoring redelivered rejection ${envelope.messageKey}`,
        );
        return;
      }
      throw error;
    }
  }
}
