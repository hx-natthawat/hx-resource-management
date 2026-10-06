import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { weekOfDate, type Week } from "@/modules/people";
import { sessionFromCookies, type SessionUser } from "./auth/session";
import { withDb, type Db } from "./db/client";
import { databaseUrl } from "./env";

/** Runs a server component's data work with a database client and the signed-in user, or sends them to sign in. */
export async function withPage<T>(run: (ctx: { db: Db; user: SessionUser }) => Promise<T>): Promise<T> {
  const url = databaseUrl();
  if (!url) redirect("/setup");
  const header = (await cookies()).toString();
  const out = await withDb(url, async (db) => {
    const user = await sessionFromCookies(db, header);
    return user ? { ok: true as const, value: await run({ db, user }) } : { ok: false as const };
  });
  if (!out.ok) redirect("/sign-in");
  return out.value;
}

/** The current week. HX_TODAY (YYYY-MM-DD) pins it for demos and screenshots. */
export const currentWeek = (): Week => weekOfDate(process.env.HX_TODAY ? new Date(`${process.env.HX_TODAY}T00:00:00Z`) : new Date());
