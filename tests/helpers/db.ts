import { chmodSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { runMigrations } from "@/server/db/migrate";

/** A migrated database for one test file: TEST_DATABASE_URL (migrated once in global setup) when set, else an embedded PostgreSQL. */
export async function startTestDb(): Promise<{ url: string; stop: () => Promise<void> }> {
  let url = process.env.TEST_DATABASE_URL ?? "";
  let stop = async () => {};
  if (!url) {
    const parent = mkdtempSync(path.join(tmpdir(), "hx-pg-"));
    chmodSync(parent, 0o777);
    const port = 54000 + Math.floor(Math.random() * 1000);
    const pg = new EmbeddedPostgres({ databaseDir: path.join(parent, "data"), user: "postgres", password: "postgres", port, persistent: false });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase("hx");
    url = `postgres://postgres:postgres@localhost:${port}/hx`;
    stop = () => pg.stop();
    await runMigrations(url, path.resolve(__dirname, "../../drizzle"));
  }
  return { url, stop };
}
