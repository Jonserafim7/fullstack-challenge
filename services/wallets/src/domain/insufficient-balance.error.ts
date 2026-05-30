export class InsufficientBalanceError extends Error {
  constructor() {
    super("Wallet has insufficient balance for this debit");
    this.name = "InsufficientBalanceError";
  }
}
