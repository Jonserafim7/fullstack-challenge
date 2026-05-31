import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import {
  WALLET_REPOSITORY,
  type WalletRepository,
} from "./domain/wallet.repository";
import { seedTestWallet } from "./infrastructure/seed/seed-test-wallet";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  await seedTestWallet(app.get<WalletRepository>(WALLET_REPOSITORY));

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Wallets API")
    .setDescription("Player wallets and balances for the crash game.")
    .setVersion("1.0")
    .addServer("/wallets", "Through the Kong gateway")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.PORT ?? "4002";
  await app.listen(port, "0.0.0.0");
  console.log(`Wallets service running on port ${port}`);
}

bootstrap();
