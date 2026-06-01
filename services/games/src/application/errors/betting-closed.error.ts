// Raised when a bet is placed while no Round is accepting bets — there is no current Round, or it
// has already left Betting (CONTEXT.md). Bets are gated by balance rules and the betting window,
// never the clock alone (ADR-0001).
export class BettingClosedError extends Error {
  constructor() {
    super("Betting is closed: no Round is currently accepting bets");
    this.name = "BettingClosedError";
  }
}
