import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "@/server/api/app";
import type { SessionUser } from "@/server/auth/session";
import { withDb } from "@/server/db/client";
import { bookings, users } from "@/server/db/schema";
import { approveDraft, say } from "@/server/voice/drafts";
import { startTestDb } from "../helpers/db";
import { makeTenant } from "../helpers/fixtures";

let url = "";
let stop = async () => {};
beforeAll(async () => {
  ({ url, stop } = await startTestDb());
});
afterAll(async () => {
  await stop();
});

const TODAY = new Date("2026-10-06T00:00:00Z");

async function seed() {
  const t = await makeTenant(url);
  return withDb(url, async (db) => {
    const mk = (email: string, role: SessionUser["role"]) => db.insert(users).values({ tenantId: t.tenantId, email, name: `${role} ${email}`, role }).returning();
    const [[pm]] = [await mk("pm@t", "PM")];
    const [[other]] = [await mk("pm2@t", "PM")];
    const [[council]] = [await mk("c@t", "Council")];
    return { ...t, pm: { tenantId: t.tenantId, userId: pm.id, name: pm.name }, other: { tenantId: t.tenantId, userId: other.id, name: other.name }, council };
  });
}

/** API where x-user picks the signed-in user row. */
function api() {
  const app = createApp({
    databaseUrl: () => url,
    devLogin: () => false,
    session: async (req, db) => {
      const id = req.headers.get("x-user");
      if (!id) return null;
      const [u] = await db.select().from(users).where(eq(users.id, id));
      return u ? { userId: u.id, tenantId: u.tenantId, name: u.name, email: u.email, role: u.role, personId: u.personId } : null;
    },
  });
  return (method: string, path: string, userId: string, body?: unknown) =>
    app.request(`/api${path}`, { method, headers: { "x-user": userId, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
}

const bookingsOf = (tenantId: string) => withDb(url, (db) => db.select().from(bookings).where(eq(bookings.tenantId, tenantId)));

describe("voice draft to approval (ADR-008)", () => {
  it("fills a draft from speech and saves nothing until the person approves", async () => {
    const s = await seed();
    const call = api();
    const first = await (await call("POST", "/voice/say", s.pm.userId, { text: "ขอ architect ให้ CRM ภาครัฐ สองวันต่อสัปดาห์" })).json();
    expect(first.missing).toEqual(["level", "startWeek", "endWeek"]);
    expect(first.question).toContain("ระดับ");
    const second = await (await call("POST", "/voice/say", s.pm.userId, { draftId: first.draft.id, text: "ซีเนียร์ ปลายตุลาถึงกลางพฤศจิกา" })).json();
    expect(second.missing).toEqual([]);
    expect(second.draft.hoursPerWeek).toMatchObject({ value: 16, source: "inferred" });
    expect(await bookingsOf(s.tenantId)).toHaveLength(0);

    const edited = await (await call("PATCH", `/drafts/${first.draft.id}`, s.pm.userId, { hoursPerWeek: 24 })).json();
    expect(edited.draft.hoursPerWeek).toEqual({ value: 24, source: "edited" });

    const ok = await call("POST", `/drafts/${first.draft.id}/approve`, s.pm.userId);
    expect(ok.status).toBe(200);
    const [b] = await bookingsOf(s.tenantId);
    expect(b).toMatchObject({ status: "Requested", personId: null, source: "voice", hoursPerWeek: 24, role: "Solution Architect", level: "Senior", projectId: s.high });
    expect(b.note).toContain("ขอ architect");
  });

  it("refuses an incomplete draft and creates one booking however often approve is pressed", async () => {
    const s = await seed();
    const call = api();
    const d = await withDb(url, (db) => say(db, s.pm, { text: "ขอ architect ซีเนียร์ ให้ CRM ภาครัฐ", today: TODAY }));
    if (!d.ok) throw new Error(d.code);
    const refused = await call("POST", `/drafts/${d.draft.id}/approve`, s.pm.userId);
    expect(refused.status).toBe(422);
    expect(await refused.json()).toMatchObject({ error: "incomplete", missing: ["hoursPerWeek", "startWeek", "endWeek"] });

    await withDb(url, (db) => say(db, s.pm, { draftId: d.draft.id, text: "เต็มเวลา เดือนหน้า", today: TODAY }));
    const results = await Promise.all([1, 2, 3].map(() => withDb(url, (db) => approveDraft(db, s.pm, d.draft.id))));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.filter((r) => r.ok && !r.alreadyApproved)).toHaveLength(1);
    expect(await bookingsOf(s.tenantId)).toHaveLength(1);
  });

  it("keeps drafts private to their owner and closed once discarded", async () => {
    const s = await seed();
    const call = api();
    const d = await (await call("POST", "/voice/say", s.pm.userId, { text: "ขอ QA ให้ AI Platform เต็มเวลา เดือนหน้า มิด" })).json();
    expect((await call("POST", `/drafts/${d.draft.id}/approve`, s.other.userId)).status).toBe(404);
    expect((await call("PATCH", `/drafts/${d.draft.id}`, s.other.userId, { hoursPerWeek: 8 })).status).toBe(404);
    expect((await call("POST", `/drafts/${d.draft.id}/discard`, s.pm.userId)).status).toBe(200);
    expect((await call("POST", `/drafts/${d.draft.id}/approve`, s.pm.userId)).status).toBe(409);
    expect((await call("POST", "/voice/say", s.pm.userId, { draftId: d.draft.id, text: "ซีเนียร์" })).status).toBe(409);
    expect(await bookingsOf(s.tenantId)).toHaveLength(0);
  });

  it("lets only PM, RM and Admin speak a demand, and validates edits", async () => {
    const s = await seed();
    const call = api();
    expect((await call("POST", "/voice/say", s.council.id, { text: "ขอ architect" })).status).toBe(403);
    const d = await (await call("POST", "/voice/say", s.pm.userId, { text: "ขอ architect" })).json();
    expect((await call("PATCH", `/drafts/${d.draft.id}`, s.pm.userId, { hoursPerWeek: 99 })).status).toBe(400);
    expect((await call("PATCH", `/drafts/${d.draft.id}`, s.pm.userId, { startDate: "2026-02-30" })).status).toBe(400);
    expect((await call("PATCH", `/drafts/${d.draft.id}`, s.pm.userId, { projectId: crypto.randomUUID() })).status).toBe(404);
  });
});
