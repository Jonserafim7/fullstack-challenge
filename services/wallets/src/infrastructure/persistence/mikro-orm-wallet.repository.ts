import { Injectable } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { Wallet } from "../../domain/wallet";
import type { WalletRepository } from "../../domain/wallet.repository";

@Injectable()
export class MikroOrmWalletRepository implements WalletRepository {
  constructor(private readonly entityManager: EntityManager) {}

  findByPlayerId(playerId: string): Promise<Wallet | null> {
    return this.entityManager.findOne(Wallet, { playerId });
  }

  async save(wallet: Wallet): Promise<void> {
    await this.entityManager.persist(wallet).flush();
  }
}
