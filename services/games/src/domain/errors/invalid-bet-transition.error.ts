export class InvalidBetTransitionError extends Error {
  constructor({ from, to }: { from: string; to: string }) {
    super(`Cannot transition a Bet from ${from} to ${to}`);
    this.name = "InvalidBetTransitionError";
  }
}
