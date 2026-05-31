export class Money {
  private constructor(private readonly amountInCents: bigint) {}

  static zero(): Money {
    return new Money(0n);
  }

  static fromCents(cents: bigint | number): Money {
    const value =
      typeof cents === "bigint" ? cents : integerCentsToBigInt(cents);
    if (value < 0n) {
      throw new RangeError(`Money cannot be negative: ${value}`);
    }
    return new Money(value);
  }

  get cents(): bigint {
    return this.amountInCents;
  }

  plus(other: Money): Money {
    return Money.fromCents(this.amountInCents + other.amountInCents);
  }

  minus(other: Money): Money {
    return Money.fromCents(this.amountInCents - other.amountInCents);
  }

  times(multiplierHundredths: number): Money {
    return Money.fromCents(
      (this.amountInCents * BigInt(multiplierHundredths)) / 100n,
    );
  }

  isLessThan(other: Money): boolean {
    return this.amountInCents < other.amountInCents;
  }
}

function integerCentsToBigInt(cents: number): bigint {
  if (!Number.isInteger(cents)) {
    throw new RangeError(`Money must be an integer number of cents: ${cents}`);
  }
  return BigInt(cents);
}
