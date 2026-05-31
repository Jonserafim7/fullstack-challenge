import { Wallet } from "../../domain/entities/wallet";

export abstract class WalletRepository {
  abstract findByPlayerId(playerId: string): Promise<Wallet | null>;
  abstract save(wallet: Wallet): Promise<void>;
}
