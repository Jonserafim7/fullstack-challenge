export class Money {
  private constructor(private readonly amountInCents: number) {}

  static zero(): Money {
    return new Money(0);
  }

  static fromCents(cents: number): Money {
    if (!Number.isInteger(cents)) {
      throw new RangeError(
        `Money must be an integer number of cents: ${cents}`,
      );
    }
    if (cents < 0) {
      throw new RangeError(`Money cannot be negative: ${cents}`);
    }
    return new Money(cents);
  }

  get cents(): number {
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
      Math.floor((this.amountInCents * multiplierHundredths) / 100),
    );
  }

  isLessThan(other: Money): boolean {
    return this.amountInCents < other.amountInCents;
  }
}
