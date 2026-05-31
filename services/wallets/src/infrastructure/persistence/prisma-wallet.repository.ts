import { Injectable } from "@nestjs/common";
import { Money } from "@crash/money";
import { WalletRepository } from "../../application/repositories/wallet.repository";
import { Wallet } from "../../domain/wallet";
import { PrismaService } from "./prisma.service";

interface WalletRow {
  playerId: string;
  balance: bigint;
}

@Injectable()
export class PrismaWalletRepository implements WalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPlayerId(playerId: string): Promise<Wallet | null> {
    const row = await this.prisma.wallet.findUnique({ where: { playerId } });
    return row ? toDomain(row) : null;
  }

  async save(wallet: Wallet): Promise<void> {
    const row = toPersistence(wallet);
    await this.prisma.wallet.upsert({
      where: { playerId: row.playerId },
      create: row,
      update: { balance: row.balance },
    });
  }
}

function toDomain(row: WalletRow): Wallet {
  return Wallet.create({
    playerId: row.playerId,
    initialBalance: Money.fromCents(row.balance),
  });
}

function toPersistence(wallet: Wallet): WalletRow {
  return {
    playerId: wallet.playerId,
    balance: wallet.balance.cents,
  };
}
