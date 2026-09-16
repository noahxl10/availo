export const DESTRUCTIVE_SEED_CONFIRMATION = "reset-demo-data";

export function assertDestructiveSeedAllowed(env: NodeJS.ProcessEnv) {
  if (!isProductionLikeSeedEnvironment(env)) return;

  const allowDestructiveSeed = env.AVAILO_ALLOW_DESTRUCTIVE_SEED === "true";
  const confirmedPurpose = env.AVAILO_DESTRUCTIVE_SEED_CONFIRM === DESTRUCTIVE_SEED_CONFIRMATION;
  if (allowDestructiveSeed && confirmedPurpose) return;

  throw new Error(
    [
      "Refusing to reset and seed data in a production-like environment.",
      "The demo seed deletes existing bookings, payment events, holds, audit logs, listings, users, and businesses before loading fixtures.",
      `To intentionally reset demo data, set AVAILO_ALLOW_DESTRUCTIVE_SEED=true and AVAILO_DESTRUCTIVE_SEED_CONFIRM=${DESTRUCTIVE_SEED_CONFIRMATION}.`
    ].join(" ")
  );
}

export function isProductionLikeSeedEnvironment(env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV === "production") return true;
  if (env.STRIPE_SECRET_KEY?.startsWith("sk_live_")) return true;

  const publicUrls = [env.APP_BASE_URL, env.API_BASE_URL, env.NEXT_PUBLIC_API_BASE_URL].filter(Boolean);
  if (publicUrls.some((url) => !isLocalHttpUrl(url))) return true;

  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) return false;
  return databaseUrl !== "file:./dev.db";
}

function isLocalHttpUrl(raw: string | undefined) {
  if (!raw) return true;
  try {
    const url = new URL(raw);
    return new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]).has(url.hostname);
  } catch {
    return true;
  }
}
