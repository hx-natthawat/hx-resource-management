import { withDb } from "@/server/db/client";
import { createApp } from "@/server/api/app";
import type { SessionUser } from "@/server/auth/session";
import { people, projects, tenants } from "@/server/db/schema";

const wsjf = { value: 5, timeCriticality: 5, riskReduction: 5, size: 5 };

/** A fresh tenant with two architects and two projects ranked 2 and 5. */
export async function makeTenant(url: string) {
  return withDb(url, async (db) => {
    const [t] = await db.insert(tenants).values({ name: `t-${crypto.randomUUID()}` }).returning();
    const person = (name: string, extra: Partial<typeof people.$inferInsert> = {}) =>
      db.insert(people).values({ tenantId: t.id, name, role: "Solution Architect", company: "HarmonyX", level: "Senior", skills: ["Integration", "AWS"], wipLimit: 3, ...extra }).returning();
    const [[anan]] = [await person("อนันต์ ส.", { isKeyResource: true })];
    const [[chayapol]] = [await person("ชยพล ก.")];
    const [[high]] = [await db.insert(projects).values({ tenantId: t.id, name: "CRM ภาครัฐ", client: "รัฐ", status: "Active", rank: 2, wsjf }).returning()];
    const [[low]] = [await db.insert(projects).values({ tenantId: t.id, name: "AI Platform", client: "เอกชน", status: "Active", rank: 5, wsjf }).returning()];
    return { tenantId: t.id, anan: anan.id, chayapol: chayapol.id, high: high.id, low: low.id };
  });
}

/** API bound to a test database; the caller's tenant and role come from x-tenant and x-role headers. */
export function testApp(url: string) {
  const app = createApp({
    databaseUrl: () => url,
    devLogin: () => false,
    session: async (req) => {
      const tenantId = req.headers.get("x-tenant");
      if (!tenantId) return null;
      const role = (req.headers.get("x-role") ?? "RM") as SessionUser["role"];
      return { userId: "00000000-0000-0000-0000-000000000000", tenantId, name: `${role} user`, email: "t@test", role, personId: null };
    },
  });
  return (path: string, tenantId: string, role: string, body?: unknown) =>
    app.request(`/api${path}`, { method: "POST", headers: { "x-tenant": tenantId, "x-role": role, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
