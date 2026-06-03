export class RoundNotVerifiableError extends Error {
  constructor(roundNumber: number) {
    super(
      `Round ${roundNumber} has not crashed yet; its Server Seed is not revealed`,
    );
    this.name = "RoundNotVerifiableError";
  }
}
