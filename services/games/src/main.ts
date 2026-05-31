import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { EnvService } from "./infrastructure/env/env.service";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const env = app.get(EnvService);

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Games API")
    .setDescription("Round lifecycle and history for the crash game.")
    .setVersion("1.0")
    .addServer("/games", "Through the Kong gateway")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = env.get("PORT");
  await app.listen(port, "0.0.0.0");
  console.log(`Games service running on port ${port}`);
}

bootstrap();
