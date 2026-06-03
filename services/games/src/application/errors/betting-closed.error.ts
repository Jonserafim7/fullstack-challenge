export class BettingClosedError extends Error {
  constructor() {
    super("Betting is closed: no Round is currently accepting bets");
    this.name = "BettingClosedError";
  }
}
