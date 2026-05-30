export class WalletNotFoundError extends Error {
  constructor() {
    super("Wallet not found for this player");
    this.name = "WalletNotFoundError";
  }
}
