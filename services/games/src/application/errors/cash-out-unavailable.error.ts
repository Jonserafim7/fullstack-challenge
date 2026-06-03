export class CashOutUnavailableError extends Error {
  constructor(reason: string) {
    super(`Cash out unavailable: ${reason}`);
    this.name = "CashOutUnavailableError";
  }
}
