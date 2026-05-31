import { Money } from "@crash/money";
import { Wallet } from "../../domain/wallet";
import type { WalletRepository } from "../../domain/wallet.repository";

const DEFAULT_STARTING_BALANCE_CENTS = 100_000n;

export async function seedTestWallet(wallets: WalletRepository): Promise<void> {
  const playerId = process.env.TEST_PLAYER_ID;
  if (!playerId) {
    return;
  }

  const existing = await wallets.findByPlayerId(playerId);
  if (existing) {
    return;
  }

  const startingBalance = Money.fromCents(
    process.env.WALLET_STARTING_BALANCE_CENTS !== undefined
      ? BigInt(process.env.WALLET_STARTING_BALANCE_CENTS)
      : DEFAULT_STARTING_BALANCE_CENTS,
  );
  await wallets.save(
    Wallet.create({ playerId, initialBalance: startingBalance }),
  );
}
