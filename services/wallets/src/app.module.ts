import { Module } from "@nestjs/common";
import { WALLET_REPOSITORY } from "./domain/wallet.repository";
import { PrismaService } from "./infrastructure/persistence/prisma.service";
import { PrismaWalletRepository } from "./infrastructure/persistence/prisma-wallet.repository";
import { JwtAuthGuard } from "./infrastructure/auth/jwt-auth.guard";
import { CreateWalletUseCase } from "./application/create-wallet.use-case";
import { GetMyWalletUseCase } from "./application/get-my-wallet.use-case";
import { HealthController } from "./presentation/controllers/health.controller";
import { WalletsController } from "./presentation/controllers/wallets.controller";

@Module({
  controllers: [HealthController, WalletsController],
  providers: [
    PrismaService,
    JwtAuthGuard,
    CreateWalletUseCase,
    GetMyWalletUseCase,
    { provide: WALLET_REPOSITORY, useClass: PrismaWalletRepository },
  ],
})
export class AppModule {}
