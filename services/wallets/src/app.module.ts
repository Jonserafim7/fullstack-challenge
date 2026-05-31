import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { WALLET_REPOSITORY } from "./domain/wallet.repository";
import { PrismaService } from "./infrastructure/persistence/prisma.service";
import { PrismaWalletRepository } from "./infrastructure/persistence/prisma-wallet.repository";
import { JwtAuthGuard } from "./infrastructure/auth/jwt-auth.guard";
import { envSchema } from "./infrastructure/env/env";
import { EnvModule } from "./infrastructure/env/env.module";
import { CreateWalletUseCase } from "./application/create-wallet.use-case";
import { GetMyWalletUseCase } from "./application/get-my-wallet.use-case";
import { HealthController } from "./presentation/controllers/health.controller";
import { WalletsController } from "./presentation/controllers/wallets.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: (env) => envSchema.parse(env),
      isGlobal: true,
    }),
    EnvModule,
  ],
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
