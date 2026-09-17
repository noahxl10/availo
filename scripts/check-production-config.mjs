import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const production = args.has("--production") || process.env.NODE_ENV === "production";
const apiEnvPath = argValue("--api-env") ?? "apps/api/.env";
const dashboardEnvPath = argValue("--dashboard-env") ?? "apps/dashboard/.env.local";

const apiEnv = loadEnvFile(apiEnvPath);
const dashboardEnv = loadEnvFile(dashboardEnvPath);
const config = {
  ...apiEnv.values,
  ...dashboardEnv.values,
  ...process.env
};

const errors = [];
const warnings = [];

for (const warning of [...apiEnv.warnings, ...dashboardEnv.warnings]) warnings.push(warning);

if (!production) {
  console.log("Config check is running in development mode. Pass --production for deploy checks.");
}

requireValue("DATABASE_URL", "API database URL");
requireValue("JWT_ACCESS_SECRET", "API access-token signing secret");
requireValue("APP_BASE_URL", "public dashboard URL");
requireValue("API_BASE_URL", "public API URL");
requireValue("NEXT_PUBLIC_API_BASE_URL", "dashboard API URL");

checkDatabaseUrl();
checkSecret("JWT_ACCESS_SECRET", { forbidden: ["local-dev-access-secret", "replace-with-a-long-random-secret"] });
if (value("JWT_REFRESH_SECRET")) {
  checkSecret("JWT_REFRESH_SECRET", { forbidden: ["replace-with-a-different-long-random-secret"] });
}
if (value("JWT_ACCESS_SECRET") && value("JWT_ACCESS_SECRET") === value("JWT_REFRESH_SECRET")) {
  issue("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.");
}

checkPublicUrl("APP_BASE_URL", { allowLocalhost: !production });
checkPublicUrl("API_BASE_URL", { allowLocalhost: !production });
checkPublicUrl("NEXT_PUBLIC_API_BASE_URL", { allowLocalhost: !production });

if (production && value("APP_BASE_URL") && value("CORS_ORIGINS")) {
  const appOrigin = originFor(value("APP_BASE_URL"));
  const origins = splitCsv(value("CORS_ORIGINS")).map(originFor);
  if (appOrigin && !origins.includes(appOrigin)) {
    errors.push("CORS_ORIGINS must include APP_BASE_URL so the dashboard can call the API.");
  }
}

if (production && !value("CORS_ORIGINS")) {
  errors.push("CORS_ORIGINS must be set explicitly in production.");
}

if (value("CORS_ORIGINS")) {
  for (const origin of splitCsv(value("CORS_ORIGINS"))) {
    if (origin === "*") {
      errors.push("CORS_ORIGINS cannot include '*' while credentialed CORS is enabled.");
      continue;
    }
    checkOrigin("CORS_ORIGINS", origin, { allowLocalhost: !production });
  }
}

if (Boolean(value("STRIPE_SECRET_KEY")) !== Boolean(value("STRIPE_WEBHOOK_SECRET"))) {
  issue("Set both STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET together when enabling Stripe.");
}

for (const warning of warnings) console.warn(`warning: ${warning}`);

if (errors.length > 0) {
  console.error("Production configuration check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(production ? "Production configuration check passed." : "Development configuration check passed.");

function argValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function loadEnvFile(path) {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) return { values: {}, warnings: [`${path} was not found; using process environment values only.`] };

  const values = {};
  const warnings = [];
  const content = readFileSync(absolutePath, "utf8");
  for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      warnings.push(`${path}:${index + 1} is not a KEY=value line and was ignored.`);
      continue;
    }

    const [, key, rawValue] = match;
    values[key] = unquote(rawValue.trim());
  }
  return { values, warnings };
}

function unquote(rawValue) {
  if (
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
  ) {
    return rawValue.slice(1, -1);
  }
  const commentIndex = rawValue.indexOf(" #");
  return commentIndex === -1 ? rawValue : rawValue.slice(0, commentIndex).trim();
}

function requireValue(name, label) {
  if (!value(name)) issue(`${name} is required for ${label}.`);
}

function checkDatabaseUrl() {
  const databaseUrl = value("DATABASE_URL");
  if (!databaseUrl) return;
  if (!databaseUrl.startsWith("file:")) return;

  const sqlitePath = databaseUrl.slice("file:".length);
  const isAbsoluteFilePath = sqlitePath.startsWith("/") && (!sqlitePath.startsWith("//") || sqlitePath.startsWith("///"));
  if (!isAbsoluteFilePath) {
    issue("DATABASE_URL must use an absolute SQLite file path in production, for example file:/var/lib/availo/prod.db.");
  }
}

function value(name) {
  return typeof config[name] === "string" ? config[name].trim() : "";
}

function checkSecret(name, { forbidden }) {
  const secret = value(name);
  if (!secret) return;
  if (secret.length < 32) issue(`${name} must be at least 32 characters long.`);
  if (forbidden.includes(secret)) issue(`${name} still uses the example value from the repository.`);
}

function checkPublicUrl(name, { allowLocalhost }) {
  const raw = value(name);
  if (!raw) return;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    errors.push(`${name} must be a valid URL.`);
    return;
  }
  if (!new Set(["http:", "https:"]).has(parsed.protocol)) errors.push(`${name} must use http or https.`);
  if (!allowLocalhost && parsed.protocol !== "https:") errors.push(`${name} must use https in production.`);
  if (!allowLocalhost && isLocalAddress(parsed.hostname)) errors.push(`${name} cannot point at a local or bind address in production.`);
}

function checkOrigin(name, raw, { allowLocalhost }) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    errors.push(`${name} contains an invalid origin: ${raw}`);
    return;
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    errors.push(`${name} origins must not include paths, query strings, or fragments: ${raw}`);
  }
  if (!allowLocalhost && parsed.protocol !== "https:") errors.push(`${name} origins must use https in production: ${raw}`);
  if (!allowLocalhost && isLocalAddress(parsed.hostname)) errors.push(`${name} cannot allow local or bind origins in production: ${raw}`);
}

function splitCsv(raw) {
  return raw.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function originFor(raw) {
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

function isLocalAddress(hostname) {
  return new Set(["localhost", "127.0.0.1", "0.0.0.0", "::", "::1", "[::]", "[::1]"]).has(hostname);
}

function issue(message) {
  if (production) {
    errors.push(message);
  } else {
    warnings.push(message);
  }
}
