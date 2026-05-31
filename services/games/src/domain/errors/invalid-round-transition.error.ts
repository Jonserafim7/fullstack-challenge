export class InvalidRoundTransitionError extends Error {
  constructor({ from, to }: { from: string; to: string }) {
    super(`Cannot transition a Round from ${from} to ${to}`);
    this.name = "InvalidRoundTransitionError";
  }
}
