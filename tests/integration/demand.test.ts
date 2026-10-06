import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { weekLoad } from "@/modules/conflict";
import { withDb } from "@/server/db/client";
import { toBooking, toPerson } from "@/server/db/mappers";
import { bookings, people } from "@/server/db/schema";
import { startTestDb } from "../helpers/db";
import { makeTenant, testApp } from "../helpers/fixtures";

let url = "";
let stop = async () => {};
let post: ReturnType<typeof testApp>;
beforeAll(async () => {
  ({ url, stop } = await startTestDb());
  post = testApp(url);
});
afterAll(async () => {
  await stop();
});

const demand = (projectId: string, extra: object = {}) => ({
  projectId,
  role: "Solution Architect",
  level: "Senior",
  skills: ["Integration"],
  hoursPerWeek: 16,
  startDate: "2026-10-19",
  endDate: "2026-11-13",
  ...extra,
});

const loadOf = async (tenantId: string, personId: string, week: number) =>
  withDb(url, async (db) => {
    const [p] = await db.select().from(people).where(eq(people.id, personId));
    const bs = await db.select().from(bookings).where(eq(bookings.tenantId, tenantId));
    return weekLoad(toPerson(p), bs.map(toBooking), week);
  });

describe("Demand and booking (#13, ADR-002)", () => {
  it("a PM demand enters as Requested with weeks from the dates and consumes nothing", async () => {
    const t = await makeTenant(url);
    const res = await post("/demands", t.tenantId, "PM", demand(t.high));
    expect(res.status).toBe(200);
    const { booking } = await res.json();
    expect(booking).toMatchObject({ status: "Requested", personId: null, startWeek: 202643, endWeek: 202646, requestedBy: "PM user" });
  });

  it("refuses a PM naming a person and points to the demand path", async () => {
    const t = await makeTenant(url);
    const res = await post("/demands", t.tenantId, "PM", demand(t.high, { personId: t.anan }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "named_person_not_allowed" });
  });

  it("walks Requested, Proposed (soft), Confirmed (hard)", async () => {
    const t = await makeTenant(url);
    const { booking } = await (await post("/demands", t.tenantId, "PM", demand(t.high))).json();

    const p = await post(`/bookings/${booking.id}/propose`, t.tenantId, "RM", { personId: t.anan });
    expect((await p.json()).booking.status).toBe("Proposed");
    expect(await loadOf(t.tenantId, t.anan, 202643)).toMatchObject({ softHours: 16, hardHours: 0, hardPercent: 0 });

    const c = await post(`/bookings/${booking.id}/confirm`, t.tenantId, "RM", { personId: t.anan });
    expect((await c.json()).booking.status).toBe("Confirmed");
    expect(await loadOf(t.tenantId, t.anan, 202643)).toMatchObject({ softHours: 0, hardHours: 16, hardPercent: 40 });
  });

  it("only a Resource Manager may propose, confirm or reject", async () => {
    const t = await makeTenant(url);
    const { booking } = await (await post("/demands", t.tenantId, "PM", demand(t.high))).json();
    for (const action of ["propose", "confirm", "reject"]) {
      expect((await post(`/bookings/${booking.id}/${action}`, t.tenantId, "PM", { personId: t.anan })).status).toBe(403);
    }
  });

  it("rejecting twice converges, and a rejected booking cannot be confirmed", async () => {
    const t = await makeTenant(url);
    const { booking } = await (await post("/demands", t.tenantId, "PM", demand(t.high))).json();
    expect((await post(`/bookings/${booking.id}/reject`, t.tenantId, "RM")).status).toBe(200);
    expect((await post(`/bookings/${booking.id}/reject`, t.tenantId, "RM")).status).toBe(200);
    expect((await post(`/bookings/${booking.id}/confirm`, t.tenantId, "RM", { personId: t.anan })).status).toBe(409);
  });

  it("cannot reach another tenant's booking", async () => {
    const a = await makeTenant(url);
    const b = await makeTenant(url);
    const { booking } = await (await post("/demands", a.tenantId, "PM", demand(a.high))).json();
    expect((await post(`/bookings/${booking.id}/propose`, b.tenantId, "RM", { personId: b.anan })).status).toBe(404);
  });
});
