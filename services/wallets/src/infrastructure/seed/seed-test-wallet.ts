import type { EntityManager } from "@mikro-orm/core";
import { Money } from "@crash/money";
import { Wallet } from "../../domain/wallet";

const DEFAULT_STARTING_BALANCE_CENTS = 100_000;

export async function seedTestWallet(
  entityManager: EntityManager,
): Promise<void> {
  const playerId = process.env.TEST_PLAYER_ID;
  if (!playerId) {
    return;
  }

  const existing = await entityManager.findOne(Wallet, { playerId });
  if (existing) {
    return;
  }

  const startingBalance = Money.fromCents(
    Number(
      process.env.WALLET_STARTING_BALANCE_CENTS ??
        DEFAULT_STARTING_BALANCE_CENTS,
    ),
  );
  const wallet = Wallet.create({ playerId, initialBalance: startingBalance });
  await entityManager.persist(wallet).flush();
}
