import { EntitySchema } from "@mikro-orm/core";
import { Money } from "@crash/money";
import { Wallet } from "../../domain/wallet";
import { MoneyType } from "./money.type";

// MikroORM maps the rich domain Wallet directly; the metadata lives here in the
// infrastructure layer (ADR-0005) so the domain entity stays free of ORM
// concerns. `currentBalance` is private on the entity, so the persisted shape is
// described structurally rather than through the entity's public type.
interface WalletPersistenceShape {
  playerId: string;
  currentBalance: Money;
}

export const WalletSchema = new EntitySchema<WalletPersistenceShape>({
  class: Wallet as unknown as new () => WalletPersistenceShape,
  properties: {
    playerId: { type: "string", primary: true, fieldName: "player_id" },
    currentBalance: { type: MoneyType, fieldName: "balance" },
  },
});
