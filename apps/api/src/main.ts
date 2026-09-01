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

function trustProxyHops() {
  const raw = process.env.TRUST_PROXY_HOPS ?? "0";
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0 || hops > 5) {
    throw new Error("TRUST_PROXY_HOPS must be an integer between 0 and 5.");
  }
  return hops;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const proxyHops = trustProxyHops();
  if (proxyHops > 0) {
    const server = app.getHttpAdapter().getInstance() as { set?: (setting: string, value: number) => void };
    server.set?.("trust proxy", proxyHops);
  }
  app.enableCors({
    origin: corsOrigins(),
    credentials: true
  });
  await app.listen(apiPort());
}

void bootstrap();
