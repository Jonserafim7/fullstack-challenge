import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import mikroOrmConfig from "./infrastructure/config/mikro-orm.config";
import { WALLET_REPOSITORY } from "./domain/wallet.repository";
import { MikroOrmWalletRepository } from "./infrastructure/persistence/mikro-orm-wallet.repository";
import { JwtAuthGuard } from "./infrastructure/auth/jwt-auth.guard";
import { CreateWalletUseCase } from "./application/create-wallet.use-case";
import { GetMyWalletUseCase } from "./application/get-my-wallet.use-case";
import { HealthController } from "./presentation/controllers/health.controller";
import { WalletsController } from "./presentation/controllers/wallets.controller";

@Module({
  imports: [MikroOrmModule.forRoot(mikroOrmConfig)],
  controllers: [HealthController, WalletsController],
  providers: [
    JwtAuthGuard,
    CreateWalletUseCase,
    GetMyWalletUseCase,
    { provide: WALLET_REPOSITORY, useClass: MikroOrmWalletRepository },
  ],
})
export class AppModule {}
