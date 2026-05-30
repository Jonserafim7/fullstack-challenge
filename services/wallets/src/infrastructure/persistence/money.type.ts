import { Type } from "@mikro-orm/core";
import { Money } from "@crash/money";

export class MoneyType extends Type<Money, string> {
  convertToDatabaseValue(value: Money): string {
    return String(value.cents);
  }

  convertToJSValue(value: string | number): Money {
    return Money.fromCents(typeof value === "string" ? Number(value) : value);
  }

  getColumnType(): string {
    return "bigint";
  }
}
