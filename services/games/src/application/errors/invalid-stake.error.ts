// Raised when a stake falls outside the allowed range or is not a whole number of cents. The
// stake is wagered money, so it is integer cents only (ADR-0004) within the README's 1.00–1000.00
// bounds (100–100000 cents).
export class InvalidStakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStakeError";
  }
}
