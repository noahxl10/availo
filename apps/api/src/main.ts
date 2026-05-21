import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

function corsOrigins() {
  const configured = process.env.CORS_ORIGINS ?? process.env.APP_BASE_URL;
  if (!configured) return [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];
  return configured.split(",").map((origin) => origin.trim()).filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: corsOrigins(),
    credentials: true
  });
  await app.listen(Number(process.env.PORT ?? 4000));
}

void bootstrap();
