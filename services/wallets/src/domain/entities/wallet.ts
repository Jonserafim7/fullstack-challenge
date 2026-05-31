import { Money } from "@crash/money";
import { InsufficientBalanceError } from "../errors/insufficient-balance.error";

export class Wallet {
  private constructor(
    public readonly playerId: string,
    private currentBalance: Money,
  ) {}

  static create({
    playerId,
    initialBalance,
  }: {
    playerId: string;
    initialBalance: Money;
  }): Wallet {
    return new Wallet(playerId, initialBalance);
  }

  get balance(): Money {
    return this.currentBalance;
  }

  credit(amount: Money): void {
    this.currentBalance = this.currentBalance.plus(amount);
  }

  debit(amount: Money): void {
    if (this.currentBalance.isLessThan(amount)) {
      throw new InsufficientBalanceError();
    }
    this.currentBalance = this.currentBalance.minus(amount);
  }
}
