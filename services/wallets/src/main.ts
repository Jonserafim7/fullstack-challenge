import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { MikroORM } from "@mikro-orm/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { seedTestWallet } from "./infrastructure/seed/seed-test-wallet";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const orm = app.get(MikroORM);
  await orm.migrator.up();
  await seedTestWallet(orm.em.fork());

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
