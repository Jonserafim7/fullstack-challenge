import { Module } from "@nestjs/common";
import { CreateWalletUseCase } from "../application/use-cases/create-wallet.use-case";
import { GetMyWalletUseCase } from "../application/use-cases/get-my-wallet.use-case";
import { AuthModule } from "../infrastructure/auth/auth.module";
import { DatabaseModule } from "../infrastructure/persistence/database.module";
import { HealthController } from "./controllers/health.controller";
import { WalletsController } from "./controllers/wallets.controller";

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [HealthController, WalletsController],
  providers: [CreateWalletUseCase, GetMyWalletUseCase],
})
export class HttpModule {}
