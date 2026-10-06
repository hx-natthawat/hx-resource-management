import path from "node:path";
import { runMigrations } from "../src/server/db/migrate";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (url) await runMigrations(url, path.resolve(__dirname, "../drizzle"));
}
