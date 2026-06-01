// Raised by the inbox when a message key has already been recorded: a redelivery of an
// at-least-once message. Callers treat it as a successful no-op (exactly-once processing).
export class DuplicateMessageError extends Error {
  constructor(messageKey: string) {
    super(`Message ${messageKey} has already been processed`);
    this.name = "DuplicateMessageError";
  }
}
