import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { wsjfOrder } from "@/modules/portfolio";
import { createApp } from "@/server/api/app";
import type { SessionUser } from "@/server/auth/session";
import { withDb } from "@/server/db/client";
import { toProject } from "@/server/db/mappers";
import { auditEvents, decisions, projects, tenants } from "@/server/db/schema";
import { saveRank } from "@/server/portfolio/rank";
import { startTestDb } from "../helpers/db";

let url = "";
let stop = async () => {};
beforeAll(async () => {
  ({ url, stop } = await startTestDb());
});
afterAll(async () => {
  await stop();
});

async function seed() {
  return withDb(url, async (db) => {
    const [t] = await db.insert(tenants).values({ name: "rank-test" }).returning();
    const mk = (name: string, rank: number, wsjf: [number, number, number, number], status = "Active") =>
      db.insert(projects).values({ tenantId: t.id, name, client: "c", status, rank, wsjf: { value: wsjf[0], timeCriticality: wsjf[1], riskReduction: wsjf[2], size: wsjf[3] } }).returning();
    const [[a], [b], [c], [closed]] = [await mk("A", 1, [20, 13, 8, 8]), await mk("B", 2, [5, 5, 5, 13]), await mk("C", 3, [13, 13, 13, 5]), await mk("Old", 4, [1, 1, 1, 1], "Closed")];
    return { tenantId: t.id, a: a.id, b: b.id, c: c.id, closed: closed.id };
  });
}

const ranks = (tenantId: string) =>
  withDb(url, async (db) => Object.fromEntries((await db.select().from(projects).where(eq(projects.tenantId, tenantId))).map((p) => [p.name, p.rank])));

describe("saveRank (#15, ADR-003)", () => {
  it("saves a WSJF order without a reason and logs one decision", async () => {
    const s = await seed();
    const rows = await withDb(url, (db) => db.select().from(projects).where(and(eq(projects.tenantId, s.tenantId), eq(projects.status, "Active"))));
    const order = wsjfOrder(rows.map(toProject));
    const r = await withDb(url, (db) => saveRank(db, { tenantId: s.tenantId, actor: "exec", order }));
    expect(r).toMatchObject({ ok: true, deviations: [] });
    expect(await ranks(s.tenantId)).toEqual({ C: 1, A: 2, B: 3, Old: 4 });
    const log = await withDb(url, (db) => db.select().from(decisions).where(eq(decisions.tenantId, s.tenantId)));
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ kind: "rank", followedRecommendation: true, decidedBy: "exec" });
  });

  it("requires a reason when the order differs from WSJF", async () => {
    const s = await seed();
    const r = await withDb(url, (db) => saveRank(db, { tenantId: s.tenantId, actor: "exec", order: [s.b, s.a, s.c] }));
    expect(r).toMatchObject({ ok: false, code: "reason_required" });
    const ok = await withDb(url, (db) => saveRank(db, { tenantId: s.tenantId, actor: "exec", order: [s.b, s.a, s.c], reason: "สัญญามีค่าปรับ" }));
    expect(ok.ok).toBe(true);
    expect(await ranks(s.tenantId)).toEqual({ B: 1, A: 2, C: 3, Old: 4 });
  });

  it("rejects ties and missing projects", async () => {
    const s = await seed();
    expect(await withDb(url, (db) => saveRank(db, { tenantId: s.tenantId, actor: "exec", order: [s.a, s.a, s.c] }))).toMatchObject({ code: "duplicate" });
    expect(await withDb(url, (db) => saveRank(db, { tenantId: s.tenantId, actor: "exec", order: [s.a, s.c] }))).toMatchObject({ code: "missing" });
    expect(await ranks(s.tenantId)).toEqual({ A: 1, B: 2, C: 3, Old: 4 });
  });

  it("is a no-op when the order is unchanged", async () => {
    const s = await seed();
    const r = await withDb(url, (db) => saveRank(db, { tenantId: s.tenantId, actor: "exec", order: [s.a, s.b, s.c], reason: "คงเดิม" }));
    expect(r).toMatchObject({ ok: true, changed: 0 });
    const events = await withDb(url, (db) => db.select().from(auditEvents).where(eq(auditEvents.tenantId, s.tenantId)));
    expect(events).toHaveLength(0);
  });

  it("only lets an Executive save the rank", async () => {
    const s = await seed();
    const app = createApp({
      databaseUrl: () => url,
      devLogin: () => false,
      session: async (req) => ({ userId: "u", tenantId: s.tenantId, name: "x", email: "x", role: (req.headers.get("x-role") ?? "PM") as SessionUser["role"], personId: null }),
    });
    const post = (role: string) => app.request("/api/portfolio/rank", { method: "POST", headers: { "x-role": role, "content-type": "application/json" }, body: JSON.stringify({ order: [s.c, s.a, s.b] }) });
    expect((await post("PM")).status).toBe(403);
    expect((await post("Executive")).status).toBe(200);
  });
});
