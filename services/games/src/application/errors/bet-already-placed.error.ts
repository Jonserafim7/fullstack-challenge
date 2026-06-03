export class BetAlreadyPlacedError extends Error {
  constructor() {
    super("This player already has a Bet on the current Round");
    this.name = "BetAlreadyPlacedError";
  }
}
