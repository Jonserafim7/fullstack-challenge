import { Module } from "@nestjs/common";
import { WalletRepository } from "../../application/repositories/wallet.repository";
import { EnvModule } from "../env/env.module";
import { PrismaService } from "./prisma.service";
import { PrismaWalletRepository } from "./prisma-wallet.repository";

@Module({
  imports: [EnvModule],
  providers: [
    PrismaService,
    { provide: WalletRepository, useClass: PrismaWalletRepository },
  ],
  exports: [PrismaService, WalletRepository],
})
export class DatabaseModule {}
