import { Money } from "@crash/money";
import { WalletRepository } from "../../application/repositories/wallet.repository";
import { Wallet } from "../../domain/entities/wallet";
import { EnvService } from "../env/env.service";

export async function seedTestWallet({
  wallets,
  env,
}: {
  wallets: WalletRepository;
  env: EnvService;
}): Promise<void> {
  const playerIds = [env.get("TEST_PLAYER_ID"), env.get("TEST_PLAYER_ID_2")];
  const startingBalance = Money.fromCents(
    env.get("WALLET_STARTING_BALANCE_CENTS"),
  );

  for (const playerId of playerIds) {
    if (!playerId) {
      continue;
    }
    const existing = await wallets.findByPlayerId(playerId);
    if (existing) {
      continue;
    }
    await wallets.save(
      Wallet.create({ playerId, initialBalance: startingBalance }),
    );
  }
}
