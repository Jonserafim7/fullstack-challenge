// Raised when a Round's verification data is requested before it can be revealed. The Server Seed
// stays secret until the Round has Crashed (ADR-0002), so a Betting or Running Round cannot be
// verified yet (#5). Maps to 409 Conflict.
export class RoundNotVerifiableError extends Error {
  constructor(roundNumber: number) {
    super(
      `Round ${roundNumber} has not crashed yet; its Server Seed is not revealed`,
    );
    this.name = "RoundNotVerifiableError";
  }
}
