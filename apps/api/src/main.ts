import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

function corsOrigins() {
  const configured = process.env.CORS_ORIGINS ?? process.env.APP_BASE_URL;
  if (!configured) return [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];

  const origins = configured.split(",").map((origin) => origin.trim()).filter(Boolean);
  if (origins.includes("*")) {
    throw new Error("CORS_ORIGINS cannot include '*' while credentialed CORS is enabled.");
  }
  return origins;
}

function apiPort() {
  const port = Number(process.env.PORT ?? 4000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return port;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: corsOrigins(),
    credentials: true
  });
  await app.listen(apiPort());
}

void bootstrap();
