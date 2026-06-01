// Raised when a cash out cannot proceed: the Round is not Running, it has already crashed (in
// curve-time, even if the phase write lags), or the caller has no Confirmed bet on it to cash out
// (ADR-0001 — cash out is valid only on a live, confirmed wager). Maps to 409 Conflict.
export class CashOutUnavailableError extends Error {
  constructor(reason: string) {
    super(`Cash out unavailable: ${reason}`);
    this.name = "CashOutUnavailableError";
  }
}
