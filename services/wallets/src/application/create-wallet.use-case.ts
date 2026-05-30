import { Inject, Injectable } from "@nestjs/common";
import { Money } from "@crash/money";
import { Wallet } from "../domain/wallet";
import {
  WALLET_REPOSITORY,
  type WalletRepository,
} from "../domain/wallet.repository";

export interface CreateWalletResult {
  wallet: Wallet;
  created: boolean;
}

@Injectable()
export class CreateWalletUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly wallets: WalletRepository,
  ) {}

  async execute({
    playerId,
  }: {
    playerId: string;
  }): Promise<CreateWalletResult> {
    const existing = await this.wallets.findByPlayerId(playerId);
    if (existing) {
      return { wallet: existing, created: false };
    }

    const wallet = Wallet.create({ playerId, initialBalance: Money.zero() });
    await this.wallets.save(wallet);
    return { wallet, created: true };
  }
}
