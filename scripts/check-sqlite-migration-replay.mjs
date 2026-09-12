import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const tempDir = mkdtempSync(join(tmpdir(), "availo-sqlite-replay-"));
const databaseUrl = `file:${join(tempDir, "replay.db")}`;

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}

async function verifySeedData() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    const [businesses, listings, bookings] = await Promise.all([
      prisma.business.count(),
      prisma.listing.count(),
      prisma.booking.count()
    ]);

    if (businesses < 1 || listings < 1 || bookings < 1) {
      throw new Error(
        `Expected seeded business, listing, and booking rows; found businesses=${businesses}, listings=${listings}, bookings=${bookings}`
      );
    }

    console.log(`SQLite migration replay verified with businesses=${businesses}, listings=${listings}, bookings=${bookings}.`);
  } finally {
    await prisma.$disconnect();
  }
}

try {
  run("npm", ["run", "db:generate"]);
  run("npm", ["run", "db:migrate"]);
  run("npm", ["run", "db:seed"]);
  await verifySeedData();
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}
