import { Money } from "@crash/money";
import { WalletRepository } from "../../application/repositories/wallet.repository";
import { Wallet } from "../../domain/wallet";
import { EnvService } from "../env/env.service";

export async function seedTestWallet({
  wallets,
  env,
}: {
  wallets: WalletRepository;
  env: EnvService;
}): Promise<void> {
  const playerId = env.get("TEST_PLAYER_ID");
  if (!playerId) {
    return;
  }

  const existing = await wallets.findByPlayerId(playerId);
  if (existing) {
    return;
  }

  const startingBalance = Money.fromCents(
    env.get("WALLET_STARTING_BALANCE_CENTS"),
  );
  await wallets.save(
    Wallet.create({ playerId, initialBalance: startingBalance }),
  );
}
