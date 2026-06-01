// Raised when a player already has a Bet on the current Round: at most one Bet per player per
// Round (CONTEXT.md). Enforced by the unique (roundNumber, playerId) constraint, so it holds even
// under two concurrent requests.
export class BetAlreadyPlacedError extends Error {
  constructor() {
    super("This player already has a Bet on the current Round");
    this.name = "BetAlreadyPlacedError";
  }
}
