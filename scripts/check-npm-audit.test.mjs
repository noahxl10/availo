import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateAudit } from "./check-npm-audit.mjs";

const NOW = new Date("2026-09-15T12:00:00Z");
const DEEPMERGE_URL = "https://github.com/advisories/GHSA-ggr8-5vv4-36mx";
const MULTER_URL = "https://github.com/advisories/GHSA-wc9g-mqfw-jrwm";
const OLD_URL = "https://github.com/advisories/GHSA-aaaa-bbbb-cccc";
const CRITICAL_URL = "https://github.com/advisories/GHSA-zzzz-yyyy-xxxx";

describe("production audit policy", () => {
  it("accepts reviewed active high-severity advisories referenced through transitive packages", () => {
    const result = evaluateAudit(
      {
        vulnerabilities: {
          prisma: { severity: "high", via: ["@prisma/config"] },
          "@prisma/config": { severity: "high", via: ["deepmerge-ts"] },
          "deepmerge-ts": { severity: "high", via: [{ url: DEEPMERGE_URL }] }
        }
      },
      allowlist([DEEPMERGE_URL]),
      NOW
    );

    assert.deepEqual(result.failures, []);
    assert.deepEqual(
      result.accepted.map((item) => item.url),
      [DEEPMERGE_URL]
    );
  });

  it("blocks unreviewed high-severity advisories", () => {
    const result = evaluateAudit(
      {
        vulnerabilities: {
          multer: { severity: "high", via: [{ url: MULTER_URL }] }
        }
      },
      {},
      NOW
    );

    assert.match(result.failures.join("\n"), /high multer/);
    assert.match(result.failures.join("\n"), new RegExp(MULTER_URL));
  });

  it("blocks expired and malformed allowlist entries", () => {
    const result = evaluateAudit(
      {
        vulnerabilities: {
          "deepmerge-ts": { severity: "high", via: [{ url: DEEPMERGE_URL }] }
        }
      },
      {
        [DEEPMERGE_URL]: { owner: "Availo maintainers", expires: "2026-09-14", reason: "Reviewed and temporary." },
        [MULTER_URL]: { owner: "", expires: "not-a-date", reason: "" },
        "not-a-url": { owner: "Availo maintainers", expires: "2026-09-30", reason: "Bad key." }
      },
      NOW
    );

    assert.match(result.failures.join("\n"), /Allowlist entry has expired/);
    assert.match(result.failures.join("\n"), /missing an owner/);
    assert.match(result.failures.join("\n"), /missing a reason/);
    assert.match(result.failures.join("\n"), /invalid expiry date/);
    assert.match(result.failures.join("\n"), /not a GitHub advisory URL/);
  });

  it("blocks impossible allowlist expiry dates instead of normalizing them", () => {
    const result = evaluateAudit(
      {
        vulnerabilities: {
          "deepmerge-ts": { severity: "high", via: [{ url: DEEPMERGE_URL }] }
        }
      },
      {
        [DEEPMERGE_URL]: {
          owner: "Availo maintainers",
          expires: "2026-09-31",
          reason: "This impossible date must not roll into October."
        }
      },
      NOW
    );

    assert.match(result.failures.join("\n"), /invalid expiry date/);
    assert.match(result.failures.join("\n"), /high deepmerge-ts/);
  });

  it("blocks a malformed top-level allowlist without throwing", () => {
    const result = evaluateAudit(
      {
        vulnerabilities: {
          "deepmerge-ts": { severity: "high", via: [{ url: DEEPMERGE_URL }] }
        }
      },
      [],
      NOW
    );

    assert.match(result.failures.join("\n"), /Allowlist must be a JSON object/);
    assert.match(result.failures.join("\n"), /high deepmerge-ts/);
  });

  it("blocks stale allowlist entries that no longer appear in npm audit", () => {
    const result = evaluateAudit(
      {
        vulnerabilities: {
          "deepmerge-ts": { severity: "high", via: [{ url: DEEPMERGE_URL }] }
        }
      },
      allowlist([DEEPMERGE_URL, OLD_URL]),
      NOW
    );

    assert.match(result.failures.join("\n"), new RegExp(OLD_URL));
    assert.match(result.failures.join("\n"), /not used by the current npm audit report/);
  });

  it("never accepts critical advisories", () => {
    const result = evaluateAudit(
      {
        vulnerabilities: {
          "danger-package": { severity: "critical", via: [{ url: CRITICAL_URL }] }
        }
      },
      allowlist([CRITICAL_URL]),
      NOW
    );

    assert.match(result.failures.join("\n"), /critical danger-package/);
  });

  it("blocks npm audit error reports", () => {
    const result = evaluateAudit({ error: { summary: "registry unavailable" } }, {}, NOW);

    assert.deepEqual(result.accepted, []);
    assert.deepEqual(result.failures, ["npm audit failed: registry unavailable"]);
  });
});

function allowlist(urls) {
  return Object.fromEntries(
    urls.map((url) => [
      url,
      {
        owner: "Availo maintainers",
        independentApproval: "Reviewed by an independent security reviewer.",
        expires: "2026-09-30",
        reason: "Reviewed temporary exception for a currently unreachable dependency advisory."
      }
    ])
  );
}
