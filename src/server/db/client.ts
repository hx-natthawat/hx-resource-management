import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

/**
 * One client per request, never global (ADR-005). On Cloudflare the connection
 * string comes from Hyperdrive; on-premise it points at the local PostgreSQL.
 */
export async function withDb<T>(connectionString: string, run: (db: Db) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await run(drizzle(client, { schema }));
  } finally {
    await client.end();
  }
}
