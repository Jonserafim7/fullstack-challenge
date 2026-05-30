import { Wallet } from "./wallet";

export const WALLET_REPOSITORY = Symbol("WALLET_REPOSITORY");

export interface WalletRepository {
  findByPlayerId(playerId: string): Promise<Wallet | null>;
  save(wallet: Wallet): Promise<void>;
}
