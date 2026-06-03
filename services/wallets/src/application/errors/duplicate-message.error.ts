export class DuplicateMessageError extends Error {
  constructor(messageKey: string) {
    super(`Message ${messageKey} has already been processed`);
    this.name = "DuplicateMessageError";
  }
}
