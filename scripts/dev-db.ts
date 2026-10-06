/**
 * Local database for development (ADR-005 data layer).
 *
 *   pnpm dev:db          start PostgreSQL if needed, migrate, seed demo data, keep running
 *   pnpm dev:db --reset  same, after wiping a local database back to empty (localhost only)
 *
 * With DATABASE_URL set (in the shell or .env.local) it uses that server and exits after seeding.
 * Without it, it starts an embedded PostgreSQL in .data/pg (macOS and most Linux) and stays up
 * until Ctrl+C. It writes DATABASE_URL and DEV_TENANT_ID to .env.local for `pnpm dev`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { withDb } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";
import { seedDemo } from "@/server/seed/demo";

const ENV_FILE = path.resolve(".env.local");

function readEnvFile(): Record<string, string> {
  if (!existsSync(ENV_FILE)) return {};
  return Object.fromEntries(
    readFileSync(ENV_FILE, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
}

function writeEnvFile(values: Record<string, string>) {
  const merged = { ...readEnvFile(), ...values };
  writeFileSync(ENV_FILE, Object.entries(merged).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
}

async function main() {
  const fromEnv = process.env.DATABASE_URL || readEnvFile().DATABASE_URL;
  let url = fromEnv;
  let stop: (() => Promise<void>) | null = null;

  if (!url) {
    const { default: EmbeddedPostgres } = await import("embedded-postgres");
    const databaseDir = path.resolve(".data/pg");
    const fresh = !existsSync(databaseDir);
    mkdirSync(path.dirname(databaseDir), { recursive: true });
    const port = 54329;
    const pg = new EmbeddedPostgres({ databaseDir, user: "postgres", password: "postgres", port, persistent: true });
    if (fresh) await pg.initialise();
    await pg.start();
    if (fresh) await pg.createDatabase("hx");
    url = `postgres://postgres:postgres@localhost:${port}/hx`;
    stop = () => pg.stop();
  }

  if (process.argv.includes("--reset")) {
    const host = new URL(url).hostname;
    if (host !== "localhost" && host !== "127.0.0.1") throw new Error(`Refusing to reset a non-local database (${host})`);
    await withDb(url, async (db) => {
      await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
      await db.execute(sql`DROP SCHEMA public CASCADE`);
      await db.execute(sql`CREATE SCHEMA public`);
    });
    console.log("Local database wiped.");
  }

  await runMigrations(url);
  const tenantId = await withDb(url, (db) => seedDemo(db));
  writeEnvFile({ DATABASE_URL: url });
  console.log(`Database ready. Demo tenant ${tenantId}. Wrote .env.local.`);

  if (!stop) return;
  console.log("Embedded PostgreSQL is running. Start the app in another terminal with `pnpm dev`. Ctrl+C to stop.");
  const shutdown = async () => {
    await stop!();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  await new Promise(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
