import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const allowlist = JSON.parse(readFileSync(new URL("../security/npm-audit-allowlist.json", import.meta.url), "utf8"));
const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], { encoding: "utf8" });

if (!result.stdout) {
  console.error(result.stderr || "npm audit produced no report");
  process.exit(1);
}

const report = JSON.parse(result.stdout);
const vulnerabilities = report.vulnerabilities ?? {};
const blocking = [];
const accepted = new Set();

function advisoryUrls(name, seen = new Set()) {
  if (seen.has(name)) return new Set();
  seen.add(name);
  const vulnerability = vulnerabilities[name];
  const urls = new Set();
  for (const via of vulnerability?.via ?? []) {
    if (typeof via === "string") {
      for (const url of advisoryUrls(via, seen)) urls.add(url);
    } else if (via.url) {
      urls.add(via.url);
    }
  }
  return urls;
}

for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
  if (!new Set(["high", "critical"]).has(vulnerability.severity)) continue;
  const urls = advisoryUrls(name);
  const allowed =
    vulnerability.severity !== "critical" &&
    urls.size > 0 &&
    [...urls].every((url) => {
      const exception = allowlist[url];
      if (!exception) return false;
      if (typeof exception.owner !== "string" || !exception.owner.trim()) return false;
      if (typeof exception.independentApproval !== "string" || !exception.independentApproval.trim()) return false;
      if (typeof exception.reason !== "string" || !exception.reason.trim()) return false;
      const expiresAt = new Date(`${exception.expires}T23:59:59Z`);
      if (Number.isNaN(expiresAt.valueOf()) || expiresAt < new Date()) return false;
      accepted.add(url);
      return true;
    });
  if (!allowed) blocking.push({ name, severity: vulnerability.severity, urls: [...urls] });
}

for (const url of accepted) {
  const exception = allowlist[url];
  console.warn(`Accepted until ${exception.expires}: ${url} (${exception.reason})`);
}

if (blocking.length > 0) {
  console.error("Unreviewed high or critical dependency advisories:");
  for (const item of blocking) console.error(`- ${item.severity} ${item.name}: ${item.urls.join(", ") || "no advisory URL"}`);
  process.exit(1);
}

console.log("No unreviewed high or critical dependency advisories.");
