import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findConflicts } from "@/modules/conflict";
import { capacityWithHolidays, weeksBetween } from "@/modules/people";
import { rejectBooking } from "@/server/booking/commands";
import { confirmBooking } from "@/server/booking/confirm";
import { decideConflict } from "@/server/conflict/decide";
import { withDb } from "@/server/db/client";
import { toBooking, toPerson } from "@/server/db/mappers";
import { bookings, decisions, holidays, people } from "@/server/db/schema";
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function seed(highEnd = 202648, lowHours = 24) {
  const t = await makeTenant(url);
  return withDb(url, async (db) => {
    const mk = (projectId: string, status: "Confirmed" | "Proposed", startWeek: number, endWeek: number, hoursPerWeek = 24) =>
      db.insert(bookings).values({ tenantId: t.tenantId, projectId, personId: t.anan, role: "Solution Architect", level: "Senior", skills: ["Integration"], hoursPerWeek, startWeek, endWeek, status, requestedBy: "pm", source: "form" }).returning();
    const [[high]] = [await mk(t.high, "Confirmed", 202643, highEnd)];
    const [[low]] = [await mk(t.low, "Proposed", 202643, 202644, lowHours)];
    return { ...t, highBooking: high.id, lowBooking: low.id };
  });
}

const booking = (id: string) => withDb(url, async (db) => (await db.select().from(bookings).where(eq(bookings.id, id)))[0]);

/** Holds a lock in its own connection until release() is called. */
function holdLock(lock: (tx: any) => Promise<unknown>) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let locked!: () => void;
  const ready = new Promise<void>((r) => (locked = r));
  const done = withDb(url, (db) =>
    db.transaction(async (tx) => {
      await lock(tx);
      locked();
      await gate;
    }),
  );
  return { ready, release, done };
}

describe("concurrency and validation found by the independent verifier (#13, #14)", () => {
  it("D1 decide must not modify a booking that a concurrent reject just made Rejected", async () => {
    const s = await seed();
    const h = holdLock((tx) => tx.select().from(bookings).where(eq(bookings.id, s.lowBooking)).for("update"));
    await h.ready;
    const rej = withDb(url, (db) => rejectBooking(db, s.tenantId, s.lowBooking, "RM")); // queues on the booking lock
    await sleep(200);
    const dec = withDb(url, (db) => decideConflict(db, { tenantId: s.tenantId, actor: "Council", personId: s.anan, bookingId: s.lowBooking, kind: "shift", requestId: crypto.randomUUID() }));
    await sleep(300); // decide has read the snapshot and is queued on UPDATE
    h.release();
    await h.done;
    const [r, d] = await Promise.all([rej, dec]);
    expect(r.ok).toBe(true);
    const b = await booking(s.lowBooking);
    // Either decide refuses, or the rejected booking is left untouched.
    expect(d.ok && b.status === "Rejected" && b.startWeek !== 202643).toBe(false);
  });

  it("D1b decide must not silently undo a concurrent confirm to another person", async () => {
    const s = await seed();
    const h = holdLock((tx) => tx.select().from(bookings).where(eq(bookings.id, s.lowBooking)).for("update"));
    await h.ready;
    const conf = withDb(url, (db) => confirmBooking(db, { tenantId: s.tenantId, bookingId: s.lowBooking, personId: s.chayapol, actor: "RM" }));
    await sleep(200);
    const dec = withDb(url, (db) => decideConflict(db, { tenantId: s.tenantId, actor: "Council", personId: s.anan, bookingId: s.lowBooking, kind: "shift", requestId: crypto.randomUUID() }));
    await sleep(300);
    h.release();
    await h.done;
    const [c, d] = await Promise.all([conf, dec]);
    expect(c).toMatchObject({ ok: true, booking: { personId: s.chayapol, status: "Confirmed" } });
    const b = await booking(s.lowBooking);
    expect({ decideOk: d.ok, personId: b.personId }).not.toEqual({ decideOk: true, personId: s.anan });
  });

  it("D2 two concurrent requests with the same requestId both return the first result", async () => {
    const s = await seed();
    const requestId = crypto.randomUUID();
    const h = holdLock((tx) => tx.select().from(people).where(eq(people.id, s.anan)).for("update"));
    await h.ready;
    const run = () => withDb(url, (db) => decideConflict(db, { tenantId: s.tenantId, actor: "Council", personId: s.anan, bookingId: s.lowBooking, kind: "shift", requestId }));
    const both = Promise.allSettled([run(), run()]);
    await sleep(300);
    h.release();
    await h.done;
    const results = await both;
    expect(results.map((r) => (r.status === "fulfilled" ? r.value.ok : `threw: ${String(r.reason).slice(0, 80)}`))).toEqual([true, true]);
  });

  it("D2b same requestId with a reduce that cannot clear the conflict never throws", async () => {
    const s = await seed();
    const requestId = crypto.randomUUID();
    const h = holdLock((tx) => tx.select().from(people).where(eq(people.id, s.anan)).for("update"));
    await h.ready;
    const run = () => withDb(url, (db) => decideConflict(db, { tenantId: s.tenantId, actor: "Council", personId: s.anan, bookingId: s.lowBooking, kind: "reduce", hoursPerWeek: 20, reason: "ลดขอบเขต", requestId }));
    const both = Promise.allSettled([run(), run()]);
    await sleep(300);
    h.release();
    await h.done;
    const results = await both;
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
  });

  it("D3 a decision that reports success must clear the conflict (shift fallback / reduce)", async () => {
    // high is confirmed for > 52 weeks, so fitShift finds nothing and falls back to the minimum shift.
    const s = await seed(202852);
    const d = await withDb(url, (db) => decideConflict(db, { tenantId: s.tenantId, actor: "Council", personId: s.anan, bookingId: s.lowBooking, kind: "shift", requestId: crypto.randomUUID() }));
    const still = await withDb(url, async (db) => {
      const [p] = await db.select().from(people).where(eq(people.id, s.anan));
      const bs = (await db.select().from(bookings).where(eq(bookings.tenantId, s.tenantId))).map(toBooking);
      return findConflicts([toPerson(p)], bs, weeksBetween(202643, 202852));
    });
    expect({ ok: d.ok, conflictRemains: still.length > 0 }).not.toEqual({ ok: true, conflictRemains: true });
  });

  it("D3b refuses a reduce that leaves the person at 110%", async () => {
    const s = await seed();
    const d = await withDb(url, (db) => decideConflict(db, { tenantId: s.tenantId, actor: "Council", personId: s.anan, bookingId: s.lowBooking, kind: "reduce", hoursPerWeek: 20, reason: "ลดขอบเขต", requestId: crypto.randomUUID() }));
    expect(d.ok).toBe(false);
  });

  it("D4 an impossible calendar date in a demand is a 400, not a 500", async () => {
    const t = await makeTenant(url);
    const post = testApp(url);
    const body = { projectId: t.high, role: "Solution Architect", level: "Senior", skills: ["Integration"], hoursPerWeek: 16, startDate: "2026-13-45", endDate: "2026-14-01" };
    const res = await post("/demands", t.tenantId, "PM", body);
    expect(res.status).toBe(400);
  });

  it("OK: confirm across the ISO year boundary is holiday-adjusted", async () => {
    const t = await makeTenant(url);
    const post = testApp(url);
    await withDb(url, async (db) => {
      await db.insert(holidays).values({ tenantId: t.tenantId, date: "2027-01-01", name: "New Year" } as never);
      await db.insert(bookings).values({ tenantId: t.tenantId, projectId: t.low, personId: t.anan, role: "Solution Architect", level: "Senior", skills: [], hoursPerWeek: 16, startWeek: 202653, endWeek: 202653, status: "Confirmed", requestedBy: "pm", source: "form" });
    });
    const { booking: b } = await (await post("/demands", t.tenantId, "PM", { projectId: t.high, role: "Solution Architect", level: "Senior", skills: [], hoursPerWeek: 24, startDate: "2026-12-28", endDate: "2027-01-08" })).json();
    expect(b).toMatchObject({ startWeek: 202653, endWeek: 202701 });
    const res = await post(`/bookings/${b.id}/confirm`, t.tenantId, "RM", { personId: t.anan });
    expect(res.status).toBe(409); // 16 + 24 = 40 > 32 (one weekday holiday)
    expect(capacityWithHolidays([{ date: "2027-01-01", name: "x" }])({ capacityHours: 40 } as never, 202653)).toBe(32);
  });

  it("OK: demand RBAC — RM and Admin may create, Executive and Council may not", async () => {
    const t = await makeTenant(url);
    const post = testApp(url);
    const body = { projectId: t.high, role: "Solution Architect", level: "Senior", skills: [], hoursPerWeek: 8, startDate: "2026-10-19", endDate: "2026-10-30" };
    expect((await post("/demands", t.tenantId, "RM", body)).status).toBe(200);
    expect((await post("/demands", t.tenantId, "Admin", body)).status).toBe(200);
    expect((await post("/demands", t.tenantId, "Executive", body)).status).toBe(403);
    expect((await post("/demands", t.tenantId, "Council", body)).status).toBe(403);
  });

  it("OK: cross-tenant substitute and booking are refused", async () => {
    const a = await seed();
    const b = await makeTenant(url);
    const sub = await withDb(url, (db) => decideConflict(db, { tenantId: a.tenantId, actor: "RM", personId: a.anan, bookingId: a.lowBooking, kind: "substitute", substituteId: b.chayapol, reason: "ข้ามบริษัท", requestId: crypto.randomUUID() }));
    expect(sub).toMatchObject({ ok: false, code: "substitute_unavailable" });
    const other = await withDb(url, (db) => decideConflict(db, { tenantId: b.tenantId, actor: "RM", personId: b.anan, bookingId: a.lowBooking, kind: "shift", requestId: crypto.randomUUID() }));
    expect(other.ok).toBe(false);
    expect(await withDb(url, (db) => db.select().from(decisions).where(eq(decisions.tenantId, b.tenantId)))).toHaveLength(0);
  });
});

describe("demand date guards", () => {
  it("refuses rolled-over dates and demands longer than a year", async () => {
    const t = await makeTenant(url);
    const post = testApp(url);
    const body = { projectId: t.high, role: "Solution Architect", level: "Senior", skills: [], hoursPerWeek: 8 };
    expect((await post("/demands", t.tenantId, "PM", { ...body, startDate: "2026-02-30", endDate: "2026-03-10" })).status).toBe(400);
    expect((await post("/demands", t.tenantId, "PM", { ...body, startDate: "2026-10-19", endDate: "9999-01-01" })).status).toBe(400);
  });
});
