import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const scriptPath = new URL("./check-production-config.mjs", import.meta.url);

describe("production config checker", () => {
  it("passes a complete production configuration", () => {
    const result = runCheck({
      apiEnv: {
        DATABASE_URL: "file:/var/lib/availo/prod.db",
        JWT_ACCESS_SECRET: "0123456789abcdef0123456789abcdef",
        JWT_REFRESH_SECRET: "fedcba9876543210fedcba9876543210",
        APP_BASE_URL: "https://book.example.com/",
        API_BASE_URL: "https://api.example.com",
        CORS_ORIGINS: "https://book.example.com"
      },
      dashboardEnv: {
        NEXT_PUBLIC_API_BASE_URL: "https://api.example.com"
      }
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Production configuration check passed.");
  });

  it("blocks placeholder secrets, localhost URLs, and wildcard CORS in production", () => {
    const result = runCheck({
      apiEnv: {
        DATABASE_URL: "file:./dev.db",
        JWT_ACCESS_SECRET: "replace-with-a-long-random-secret",
        JWT_REFRESH_SECRET: "replace-with-a-different-long-random-secret",
        APP_BASE_URL: "http://localhost:3000",
        API_BASE_URL: "https://api.example.com",
        CORS_ORIGINS: "*"
      },
      dashboardEnv: {
        NEXT_PUBLIC_API_BASE_URL: "https://api.example.com"
      }
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("JWT_ACCESS_SECRET still uses the example value");
    expect(result.stderr).toContain("APP_BASE_URL cannot point at a local or bind address");
    expect(result.stderr).toContain("CORS_ORIGINS cannot include '*'");
  });

  it("lets process environment override env-file defaults", () => {
    const result = runCheck({
      apiEnv: {
        DATABASE_URL: "file:./dev.db",
        JWT_ACCESS_SECRET: "replace-with-a-long-random-secret",
        JWT_REFRESH_SECRET: "replace-with-a-different-long-random-secret",
        APP_BASE_URL: "http://localhost:3000",
        API_BASE_URL: "http://localhost:4000",
        CORS_ORIGINS: "http://localhost:3000"
      },
      dashboardEnv: {
        NEXT_PUBLIC_API_BASE_URL: "http://localhost:4000"
      },
      env: {
        DATABASE_URL: "file:/var/lib/availo/prod.db",
        JWT_ACCESS_SECRET: "0123456789abcdef0123456789abcdef",
        JWT_REFRESH_SECRET: "fedcba9876543210fedcba9876543210",
        APP_BASE_URL: "https://book.example.com",
        API_BASE_URL: "https://api.example.com",
        CORS_ORIGINS: "https://book.example.com",
        NEXT_PUBLIC_API_BASE_URL: "https://api.example.com"
      }
    });

    expect(result.status).toBe(0);
  });

  it("allows JWT_REFRESH_SECRET to be omitted while refresh tokens are opaque", () => {
    const result = runCheck({
      apiEnv: {
        DATABASE_URL: "file:/var/lib/availo/prod.db",
        JWT_ACCESS_SECRET: "0123456789abcdef0123456789abcdef",
        APP_BASE_URL: "https://book.example.com",
        API_BASE_URL: "https://api.example.com",
        CORS_ORIGINS: "https://book.example.com"
      },
      dashboardEnv: {
        NEXT_PUBLIC_API_BASE_URL: "https://api.example.com"
      }
    });

    expect(result.status).toBe(0);
  });

  it("blocks bind addresses as production public URLs", () => {
    const result = runCheck({
      apiEnv: {
        DATABASE_URL: "file:/var/lib/availo/prod.db",
        JWT_ACCESS_SECRET: "0123456789abcdef0123456789abcdef",
        APP_BASE_URL: "https://0.0.0.0",
        API_BASE_URL: "https://api.example.com",
        CORS_ORIGINS: "https://0.0.0.0"
      },
      dashboardEnv: {
        NEXT_PUBLIC_API_BASE_URL: "https://api.example.com"
      }
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("APP_BASE_URL cannot point at a local or bind address");
    expect(result.stderr).toContain("CORS_ORIGINS cannot allow local or bind origins");
  });

  it("blocks partial Stripe configuration in production", () => {
    const result = runCheck({
      apiEnv: {
        DATABASE_URL: "file:/var/lib/availo/prod.db",
        JWT_ACCESS_SECRET: "0123456789abcdef0123456789abcdef",
        JWT_REFRESH_SECRET: "fedcba9876543210fedcba9876543210",
        APP_BASE_URL: "https://book.example.com",
        API_BASE_URL: "https://api.example.com",
        CORS_ORIGINS: "https://book.example.com",
        STRIPE_SECRET_KEY: "sk_live_example"
      },
      dashboardEnv: {
        NEXT_PUBLIC_API_BASE_URL: "https://api.example.com"
      }
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Set both STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET together");
  });
});

function runCheck({ apiEnv, dashboardEnv, env = {} }) {
  const dir = mkdtempSync(join(tmpdir(), "availo-config-check-"));
  const apiPath = join(dir, "api.env");
  const dashboardPath = join(dir, "dashboard.env");
  writeFileSync(apiPath, serializeEnv(apiEnv));
  writeFileSync(dashboardPath, serializeEnv(dashboardEnv));

  return spawnSync(
    process.execPath,
    [scriptPath.pathname, "--production", `--api-env=${apiPath}`, `--dashboard-env=${dashboardPath}`],
    {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        ...env
      }
    }
  );
}

function serializeEnv(values) {
  return Object.entries(values)
    .map(([key, value]) => `${key}="${value}"`)
    .join("\n");
}
