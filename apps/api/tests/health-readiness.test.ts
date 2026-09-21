import { describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "../src/app.module.js";
import { configureApiHttp } from "../src/api-http.js";
import { HealthController } from "../src/health/health.controller.js";

describe("health and readiness endpoints", () => {
  it("exposes unauthenticated process and database readiness probes", async () => {
    await withHttpApp(async (baseUrl) => {
      const health = await fetch(`${baseUrl}/healthz`);
      expect(health.status).toBe(200);
      expect(health.headers.get("cache-control")).toBe("no-store");
      await expect(health.json()).resolves.toEqual({ ok: true });

      const ready = await fetch(`${baseUrl}/readyz`);
      expect(ready.status).toBe(200);
      expect(ready.headers.get("cache-control")).toBe("no-store");
      await expect(ready.json()).resolves.toEqual({ ok: true });
    });
  });

  it("returns a non-sensitive 503 response when the database probe fails", async () => {
    const controller = new HealthController({
      $queryRaw: async () => {
        throw new Error("file path and SQL details stay private");
      }
    } as never);

    await expect(controller.readyz()).rejects.toMatchObject({
      response: { ok: false, error: "database_unavailable" },
      status: 503
    });
  });
});

async function withHttpApp<T>(callback: (baseUrl: string) => Promise<T>) {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true, bodyParser: false, logger: false });
  configureApiHttp(app);
  await app.listen(0);
  const address = app.getHttpServer().address() as AddressInfo;
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await app.close();
  }
}
