import type { NestExpressApplication } from "@nestjs/platform-express";

const DEFAULT_API_BODY_LIMIT = "256kb";

export function configureApiHttp(app: NestExpressApplication) {
  const bodyLimit = apiBodyLimit();
  app.useBodyParser("json", { limit: bodyLimit });
  app.useBodyParser("urlencoded", { extended: true, limit: bodyLimit, parameterLimit: 100, depth: 8 });

  const proxyHops = trustProxyHops();
  if (proxyHops > 0) {
    const server = app.getHttpAdapter().getInstance() as { set?: (setting: string, value: number) => void };
    server.set?.("trust proxy", proxyHops);
  }
}

export function apiBodyLimit() {
  const raw = process.env.API_BODY_LIMIT ?? DEFAULT_API_BODY_LIMIT;
  if (!/^[1-9]\d*(b|kb|mb)$/i.test(raw)) {
    throw new Error("API_BODY_LIMIT must be a positive size such as 256kb, 1mb, or 1048576b.");
  }
  return raw.toLowerCase();
}

export function trustProxyHops() {
  const raw = process.env.TRUST_PROXY_HOPS ?? "0";
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0 || hops > 5) {
    throw new Error("TRUST_PROXY_HOPS must be an integer between 0 and 5.");
  }
  return hops;
}
