import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_ALLOWLIST_URL = new URL("../security/npm-audit-allowlist.json", import.meta.url);
const HIGH_OR_CRITICAL = new Set(["high", "critical"]);

function main() {
  const allowlistUrl = process.env.AVAILO_AUDIT_ALLOWLIST_PATH ? pathToFileURL(resolve(process.env.AVAILO_AUDIT_ALLOWLIST_PATH)) : DEFAULT_ALLOWLIST_URL;
  const allowlist = readJsonFile(allowlistUrl, "audit allowlist");
  const report = process.env.AVAILO_AUDIT_REPORT_PATH ? readJsonFile(pathToFileURL(resolve(process.env.AVAILO_AUDIT_REPORT_PATH)), "audit report") : readNpmAuditReport();
  const result = evaluateAudit(report, allowlist, new Date());

  for (const item of result.accepted) {
    console.warn(`Accepted until ${item.expires}: ${item.url} (${item.reason})`);
  }

  if (result.failures.length > 0) {
    console.error("Dependency audit policy failures:");
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("No unreviewed high or critical dependency advisories.");
}

export function evaluateAudit(report, allowlist, now = new Date()) {
  if (report?.error) {
    return { accepted: [], failures: [`npm audit failed: ${formatAuditError(report.error)}`] };
  }

  const vulnerabilities = report.vulnerabilities ?? {};
  const failures = validateAllowlist(allowlist, now);
  const allowlistEntries = isRecord(allowlist) ? allowlist : {};
  const acceptedByUrl = new Map();

  for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
    if (!HIGH_OR_CRITICAL.has(vulnerability.severity)) continue;
    const urls = advisoryUrls(vulnerabilities, name);
    const allowed =
      vulnerability.severity !== "critical" &&
      urls.size > 0 &&
      [...urls].every((url) => {
        const exception = allowlistEntries[url];
        if (!exception || !isValidException(exception, now)) return false;
        acceptedByUrl.set(url, { url, expires: exception.expires, reason: exception.reason });
        return true;
      });

    if (!allowed) {
      failures.push(`${vulnerability.severity} ${name}: ${[...urls].join(", ") || "no advisory URL"}`);
    }
  }

  for (const url of Object.keys(allowlistEntries)) {
    if (!acceptedByUrl.has(url)) failures.push(`Allowlist entry is not used by the current npm audit report: ${url}`);
  }

  return { accepted: [...acceptedByUrl.values()].sort((a, b) => a.url.localeCompare(b.url)), failures };
}

function advisoryUrls(vulnerabilities, name, seen = new Set()) {
  if (seen.has(name)) return new Set();
  seen.add(name);
  const vulnerability = vulnerabilities[name];
  const urls = new Set();
  for (const via of vulnerability?.via ?? []) {
    if (typeof via === "string") {
      for (const url of advisoryUrls(vulnerabilities, via, seen)) urls.add(url);
    } else if (via.url) {
      urls.add(via.url);
    }
  }
  return urls;
}

function validateAllowlist(allowlist, now) {
  const failures = [];
  if (!isRecord(allowlist)) {
    return ["Allowlist must be a JSON object keyed by advisory URL"];
  }

  for (const [url, exception] of Object.entries(allowlist)) {
    if (!/^https:\/\/github\.com\/advisories\/GHSA-[a-z0-9-]+$/i.test(url)) {
      failures.push(`Allowlist key is not a GitHub advisory URL: ${url}`);
    }
    if (!exception || typeof exception !== "object" || Array.isArray(exception)) {
      failures.push(`Allowlist entry must be an object: ${url}`);
      continue;
    }
    if (typeof exception.owner !== "string" || !exception.owner.trim()) {
      failures.push(`Allowlist entry is missing an owner: ${url}`);
    }
    if (typeof exception.independentApproval !== "string" || !exception.independentApproval.trim()) {
      failures.push(`Allowlist entry is missing independent approval: ${url}`);
    }
    if (typeof exception.reason !== "string" || !exception.reason.trim()) {
      failures.push(`Allowlist entry is missing a reason: ${url}`);
    }
    if (!isValidDateOnly(exception.expires)) {
      failures.push(`Allowlist entry has an invalid expiry date: ${url}`);
      continue;
    }
    const expiresAt = new Date(`${exception.expires}T23:59:59Z`);
    if (Number.isNaN(expiresAt.valueOf()) || expiresAt < now) {
      failures.push(`Allowlist entry has expired: ${url}`);
    }
  }
  return failures;
}

function isValidException(exception, now) {
  if (!isRecord(exception)) return false;
  if (typeof exception.owner !== "string" || !exception.owner.trim()) return false;
  if (typeof exception.independentApproval !== "string" || !exception.independentApproval.trim()) return false;
  if (typeof exception.reason !== "string" || !exception.reason.trim()) return false;
  if (!isValidDateOnly(exception.expires)) return false;
  const expiresAt = new Date(`${exception.expires}T23:59:59Z`);
  return !Number.isNaN(expiresAt.valueOf()) && expiresAt >= now;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidDateOnly(value) {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function formatAuditError(error) {
  if (typeof error === "string") return error;
  if (isRecord(error) && typeof error.summary === "string") return error.summary;
  if (isRecord(error) && typeof error.message === "string") return error.message;
  return JSON.stringify(error);
}

function readJsonFile(url, label) {
  try {
    return JSON.parse(readFileSync(url, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to read ${label}: ${message}`);
    process.exit(1);
  }
}

function readNpmAuditReport() {
  const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], { encoding: "utf8" });
  if (!result.stdout) {
    console.error(result.stderr || "npm audit produced no report");
    process.exit(1);
  }
  const report = JSON.parse(result.stdout);
  if (result.status !== 0 && report.error) {
    console.error(`npm audit failed: ${formatAuditError(report.error)}`);
    process.exit(1);
  }
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
