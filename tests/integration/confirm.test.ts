import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "@/server/api/app";
import type { SessionUser } from "@/server/auth/session";
import { confirmBooking } from "@/server/booking/confirm";
import { withDb } from "@/server/db/client";
import { auditEvents, bookings, people, projects, tenants } from "@/server/db/schema";
import { startTestDb } from "../helpers/db";

let url = "";
let stop = async () => {};

beforeAll(async () => {
  ({ url, stop } = await startTestDb());
});

afterAll(async () => {
  await stop();
});

const W43 = 202643;
const W44 = 202644;

async function seed() {
  return withDb(url, async (db) => {
    const [t] = await db.insert(tenants).values({ name: "HarmonyX" }).returning();
    const [anan] = await db.insert(people).values({ tenantId: t.id, name: "อนันต์ ส.", role: "Solution Architect", company: "HarmonyX", level: "Senior", skills: ["Integration"], isKeyResource: true, wipLimit: 3 }).returning();
    const wsjf = { value: 5, timeCriticality: 5, riskReduction: 5, size: 5 };
    const [crm] = await db.insert(projects).values({ tenantId: t.id, name: "CRM ภาครัฐ", client: "รัฐ", status: "Active", rank: 2, wsjf }).returning();
    const [ai] = await db.insert(projects).values({ tenantId: t.id, name: "AI Platform", client: "เอกชน", status: "Active", rank: 5, wsjf }).returning();
    const base = { tenantId: t.id, role: "Solution Architect", level: "Senior", startWeek: W43, endWeek: W44, requestedBy: "pm", source: "form" as const };
    await db.insert(bookings).values({ ...base, projectId: crm.id, personId: anan.id, hoursPerWeek: 24, status: "Confirmed" });
    const [a] = await db.insert(bookings).values({ ...base, projectId: ai.id, hoursPerWeek: 16, status: "Requested" }).returning();
    const [b] = await db.insert(bookings).values({ ...base, projectId: crm.id, hoursPerWeek: 16, status: "Requested" }).returning();
    return { tenantId: t.id, personId: anan.id, a: a.id, b: b.id };
  });
}

describe("confirmBooking against PostgreSQL (ADR-006)", () => {
  it("confirms when the person stays within capacity and writes an audit event", async () => {
    const s = await seed();
    const r = await withDb(url, (db) => confirmBooking(db, { tenantId: s.tenantId, bookingId: s.a, personId: s.personId, actor: "rm" }));
    expect(r.ok && r.booking.status).toBe("Confirmed");
    const events = await withDb(url, (db) => db.select().from(auditEvents).where(sql`${auditEvents.entityId} = ${s.a}`));
    expect(events).toHaveLength(1);
    expect(events[0].after).toMatchObject({ status: "Confirmed", personId: s.personId });
  });

  it("refuses a confirmation that would push the person over 100%", async () => {
    const s = await seed();
    await withDb(url, (db) => confirmBooking(db, { tenantId: s.tenantId, bookingId: s.a, personId: s.personId, actor: "rm" }));
    const r = await withDb(url, (db) => confirmBooking(db, { tenantId: s.tenantId, bookingId: s.b, personId: s.personId, actor: "rm" }));
    expect(r).toMatchObject({ ok: false, code: "over_capacity", peakPercent: 140 });
  });

  it("converges when the same confirmation is sent twice", async () => {
    const s = await seed();
    const input = { tenantId: s.tenantId, bookingId: s.a, personId: s.personId, actor: "rm" };
    await withDb(url, (db) => confirmBooking(db, input));
    const again = await withDb(url, (db) => confirmBooking(db, input));
    expect(again).toMatchObject({ ok: true, alreadyConfirmed: true });
  });

  it("lets only one of two racing confirmations through", async () => {
    const s = await seed();
    const results = await Promise.all(
      [s.a, s.b].map((bookingId) => withDb(url, (db) => confirmBooking(db, { tenantId: s.tenantId, bookingId, personId: s.personId, actor: "rm" }))),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.code === "over_capacity")).toHaveLength(1);
  });

  it("keeps the audit log append-only", async () => {
    const s = await seed();
    await withDb(url, (db) => confirmBooking(db, { tenantId: s.tenantId, bookingId: s.a, personId: s.personId, actor: "rm" }));
    const err = await withDb(url, (db) => db.execute(sql`UPDATE audit_events SET actor = 'x'`)).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect(String((err as Error & { cause?: Error }).cause?.message)).toMatch(/append-only/);
  });
});

describe("API edge", () => {
  const app = createApp({
    databaseUrl: () => url,
    devLogin: () => false,
    session: async (req) => {
      const tenantId = req.headers.get("x-tenant");
      const role = (req.headers.get("x-role") ?? "RM") as SessionUser["role"];
      return tenantId ? { userId: "00000000-0000-0000-0000-000000000000", tenantId, name: "rm", email: "rm@test", role, personId: null } : null;
    },
  });

  it("rejects callers without a session", async () => {
    const res = await app.request("/api/bookings/00000000-0000-0000-0000-000000000000/confirm", { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
  });

  it("forbids a PM from confirming (RBAC)", async () => {
    const res = await app.request("/api/bookings/00000000-0000-0000-0000-000000000000/confirm", { method: "POST", headers: { "x-tenant": "t", "x-role": "PM" }, body: "{}" });
    expect(res.status).toBe(403);
  });

  it("validates input at the boundary", async () => {
    const res = await app.request("/api/bookings/not-a-uuid/confirm", { method: "POST", headers: { "x-tenant": "t" }, body: JSON.stringify({ personId: "nope" }) });
    expect(res.status).toBe(400);
  });

  it("returns 409 with the peak when capacity would be exceeded", async () => {
    const s = await seed();
    const call = (bookingId: string) =>
      app.request(`/api/bookings/${bookingId}/confirm`, { method: "POST", headers: { "x-tenant": s.tenantId, "content-type": "application/json" }, body: JSON.stringify({ personId: s.personId }) });
    expect((await call(s.a)).status).toBe(200);
    const res = await call(s.b);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "over_capacity", peakPercent: 140 });
  });

  it("hides dev sign-in when it is disabled", async () => {
    const res = await app.request("/api/dev/sign-in", { method: "POST", body: JSON.stringify({ userId: "00000000-0000-0000-0000-000000000000" }) });
    expect(res.status).toBe(404);
  });
});
