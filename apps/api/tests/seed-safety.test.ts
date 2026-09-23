import { describe, expect, it } from "vitest";
import { assertDestructiveSeedAllowed, isProductionLikeSeedEnvironment } from "../prisma/seed-safety.js";

describe("demo seed safety guard", () => {
  it("allows the default local demo database", () => {
    const env = {
      DATABASE_URL: "file:./dev.db",
      APP_BASE_URL: "http://localhost:3000",
      API_BASE_URL: "http://localhost:4000",
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:4000"
    };

    expect(isProductionLikeSeedEnvironment(env)).toBe(false);
    expect(() => assertDestructiveSeedAllowed(env)).not.toThrow();
  });

  it("blocks production mode without explicit destructive-seed confirmation", () => {
    expect(() => assertDestructiveSeedAllowed({ NODE_ENV: "production", DATABASE_URL: "file:./dev.db" })).toThrow(
      /Refusing to reset and seed data/
    );
  });

  it("blocks non-local public URLs without explicit destructive-seed confirmation", () => {
    const env = {
      DATABASE_URL: "file:./dev.db",
      APP_BASE_URL: "https://book.example.com",
      API_BASE_URL: "https://api.example.com",
      NEXT_PUBLIC_API_BASE_URL: "https://api.example.com"
    };

    expect(isProductionLikeSeedEnvironment(env)).toBe(true);
    expect(() => assertDestructiveSeedAllowed(env)).toThrow(/Refusing to reset and seed data/);
  });

  it("blocks malformed configured public URLs without explicit destructive-seed confirmation", () => {
    const env = {
      DATABASE_URL: "file:./dev.db",
      APP_BASE_URL: "book.example.com"
    };

    expect(isProductionLikeSeedEnvironment(env)).toBe(true);
    expect(() => assertDestructiveSeedAllowed(env)).toThrow(/Refusing to reset and seed data/);
  });

  it("blocks any non-default database URL without explicit destructive-seed confirmation", () => {
    expect(isProductionLikeSeedEnvironment({ DATABASE_URL: "file:./data/prod.db" })).toBe(true);
    expect(isProductionLikeSeedEnvironment({ DATABASE_URL: "file:../prod.db" })).toBe(true);
    expect(isProductionLikeSeedEnvironment({ DATABASE_URL: "file:/var/lib/availo/prod.db" })).toBe(true);
    expect(isProductionLikeSeedEnvironment({ DATABASE_URL: "postgresql://user:pass@example.com/availo" })).toBe(true);
  });

  it("allows an intentional production-like reset only with both confirmations", () => {
    const env = {
      NODE_ENV: "production",
      DATABASE_URL: "file:/var/lib/availo/prod.db",
      AVAILO_ALLOW_DESTRUCTIVE_SEED: "true",
      AVAILO_DESTRUCTIVE_SEED_CONFIRM: "reset-demo-data"
    };

    expect(() => assertDestructiveSeedAllowed(env)).not.toThrow();
  });
});
