import { and, eq } from "drizzle-orm";
import type { AppRole } from "@/modules/people";
import type { Db } from "../db/client";
import { users } from "../db/schema";
import { devLoginEnabled } from "../env";

export const DEV_COOKIE = "hx_dev_user";

export interface SessionUser {
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  role: AppRole;
  personId: string | null;
}

export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves the signed-in user. Until Google Workspace sign-in lands (#16), only the
 * dev cookie is accepted, and only where dev sign-in is enabled. Production returns null.
 */
export async function sessionFromCookies(db: Db, cookieHeader: string | null | undefined): Promise<SessionUser | null> {
  if (!devLoginEnabled()) return null;
  const id = readCookie(cookieHeader, DEV_COOKIE);
  if (!id || !UUID.test(id)) return null;
  const [u] = await db.select().from(users).where(and(eq(users.id, id)));
  if (!u) return null;
  return { userId: u.id, tenantId: u.tenantId, name: u.name, email: u.email, role: u.role, personId: u.personId };
}
