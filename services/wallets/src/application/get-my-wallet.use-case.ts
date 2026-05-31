import { Injectable } from "@nestjs/common";
import { Wallet } from "../domain/wallet";
import { WalletRepository } from "./repositories/wallet.repository";
import { WalletNotFoundError } from "./wallet-not-found.error";

@Injectable()
export class GetMyWalletUseCase {
  constructor(private readonly wallets: WalletRepository) {}

  async execute({ playerId }: { playerId: string }): Promise<Wallet> {
    const wallet = await this.wallets.findByPlayerId(playerId);
    if (!wallet) {
      throw new WalletNotFoundError();
    }
    return wallet;
  }
}
