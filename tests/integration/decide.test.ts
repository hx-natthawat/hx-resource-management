import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decideConflict } from "@/server/conflict/decide";
import { withDb } from "@/server/db/client";
import { auditEvents, bookings, decisions, notifications, projects, users } from "@/server/db/schema";
import { startTestDb } from "../helpers/db";
import { makeTenant, testApp } from "../helpers/fixtures";

let url = "";
let stop = async () => {};
beforeAll(async () => {
  ({ url, stop } = await startTestDb());
});
afterAll(async () => {
  await stop();
});

/** อนันต์ is confirmed 24 h on the rank-2 project W43 to W48 and proposed 24 h on the rank-5 project W43 to W44: 120%. */
async function seed() {
  const t = await makeTenant(url);
  return withDb(url, async (db) => {
    const [owner] = await db.insert(users).values({ tenantId: t.tenantId, email: "pm@t", name: "PM ของ AI", role: "PM" }).returning();
    await db.update(projects).set({ ownerUserId: owner.id }).where(eq(projects.id, t.low));
    const mk = (projectId: string, status: "Confirmed" | "Proposed", startWeek: number, endWeek: number) =>
      db.insert(bookings).values({ tenantId: t.tenantId, projectId, personId: t.anan, role: "Solution Architect", level: "Senior", skills: ["Integration"], hoursPerWeek: 24, startWeek, endWeek, status, requestedBy: "pm", source: "form" }).returning();
    const [[high]] = [await mk(t.high, "Confirmed", 202643, 202648)];
    const [[low]] = [await mk(t.low, "Proposed", 202643, 202644)];
    return { ...t, owner: owner.id, highBooking: high.id, lowBooking: low.id };
  });
}

const booking = (id: string) => withDb(url, async (db) => (await db.select().from(bookings).where(eq(bookings.id, id)))[0]);
const log = (tenantId: string) => withDb(url, (db) => db.select().from(decisions).where(eq(decisions.tenantId, tenantId)));

describe("decideConflict (#14, ADR-003, ADR-006)", () => {
  it("keeps the rank-2 project and moves rank 5 to the first weeks that fit", async () => {
    const s = await seed();
    const r = await withDb(url, (db) => decideConflict(db, { tenantId: s.tenantId, actor: "Council", personId: s.anan, bookingId: s.lowBooking, kind: "shift", requestId: crypto.randomUUID() }));
    expect(r).toMatchObject({ ok: true, decision: { kind: "shift", followedRecommendation: true, weeks: [202643, 202644], decidedBy: "Council" } });
    expect(await booking(s.lowBooking)).toMatchObject({ startWeek: 202649, endWeek: 202650, personId: s.anan });
    expect(await booking(s.highBooking)).toMatchObject({ startWeek: 202643, endWeek: 202648 });

    const events = await withDb(url, (db) => db.select().from(auditEvents).where(and(eq(auditEvents.tenantId, s.tenantId), eq(auditEvents.entityId, s.lowBooking))));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: "decide.shift", before: { startWeek: 202643 }, after: { startWeek: 202649 } });

    const notes = await withDb(url, (db) => db.select().from(notifications).where(eq(notifications.userId, s.owner)));
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toContain("AI Platform");
  });

  it("needs a reason to override the rank rule, and logs who, when and why", async () => {
    const s = await seed();
    const post = testApp(url);
    const body = { requestId: crypto.randomUUID(), personId: s.anan, bookingId: s.highBooking, kind: "shift" };
    const refused = await post("/conflicts/decide", s.tenantId, "Council", body);
    expect(refused.status).toBe(422);
    expect(await refused.json()).toMatchObject({ error: "reason_required" });
    expect(await log(s.tenantId)).toHaveLength(0);

    const ok = await post("/conflicts/decide", s.tenantId, "Council", { ...body, reason: "ลูกค้า CRM ขอเลื่อน UAT เอง" });
    expect(ok.status).toBe(200);
    const [d] = await log(s.tenantId);
    expect(d).toMatchObject({ followedRecommendation: false, reason: "ลูกค้า CRM ขอเลื่อน UAT เอง", decidedBy: "Council user", personId: s.anan, bookingId: s.highBooking });
    expect(d.decidedAt).toBeInstanceOf(Date);
  });

  it("substitutes someone with room, and refuses when the substitute would be over", async () => {
    const s = await seed();
    const sub = await withDb(url, (db) => decideConflict(db, { tenantId: s.tenantId, actor: "RM", personId: s.anan, bookingId: s.lowBooking, kind: "substitute", substituteId: s.chayapol, reason: "ชยพลว่างพอ", requestId: crypto.randomUUID() }));
    expect(sub.ok).toBe(true);
    expect((await booking(s.lowBooking)).personId).toBe(s.chayapol);
  });

  it("applies a retried request once", async () => {
    const s = await seed();
    const requestId = crypto.randomUUID();
    const run = () => withDb(url, (db) => decideConflict(db, { tenantId: s.tenantId, actor: "Council", personId: s.anan, bookingId: s.lowBooking, kind: "shift", requestId }));
    expect(await run()).toMatchObject({ ok: true, replayed: false });
    expect(await run()).toMatchObject({ ok: true, replayed: true });
    expect(await log(s.tenantId)).toHaveLength(1);
    expect((await booking(s.lowBooking)).startWeek).toBe(202649);
  });

  it("lets only one of two simultaneous decisions act; the other sees the conflict is gone", async () => {
    const s = await seed();
    const run = (kind: "shift" | "reduce") =>
      withDb(url, (db) => decideConflict(db, { tenantId: s.tenantId, actor: "Council", personId: s.anan, bookingId: s.lowBooking, kind, reason: "ทดสอบพร้อมกัน", requestId: crypto.randomUUID() }));
    const results = await Promise.all([run("shift"), run("reduce")]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ code: "no_conflict" });
    expect(await log(s.tenantId)).toHaveLength(1);
  });

  it("only Council, RM and Admin may decide", async () => {
    const s = await seed();
    const post = testApp(url);
    const body = { requestId: crypto.randomUUID(), personId: s.anan, bookingId: s.lowBooking, kind: "shift" };
    expect((await post("/conflicts/decide", s.tenantId, "PM", body)).status).toBe(403);
    expect((await post("/conflicts/decide", s.tenantId, "Executive", body)).status).toBe(403);
    expect((await post("/conflicts/decide", s.tenantId, "Council", { ...body, extra: 1 })).status).toBe(400);
  });
});
