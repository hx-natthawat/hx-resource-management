import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findConflicts } from "@/modules/conflict";
import { capacityWithHolidays, weeksFrom } from "@/modules/people";
import { withDb } from "@/server/db/client";
import { toBooking, toHoliday, toPerson } from "@/server/db/mappers";
import { bookings, holidays, people, users } from "@/server/db/schema";
import { seedDemo } from "@/server/seed/demo";
import { startTestDb } from "../helpers/db";

let url = "";
let stop = async () => {};
beforeAll(async () => {
  ({ url, stop } = await startTestDb());
});
afterAll(async () => {
  await stop();
});

describe("demo seed", () => {
  it("is idempotent", async () => {
    const a = await withDb(url, seedDemo);
    const b = await withDb(url, seedDemo);
    expect(b).toBe(a);
    const count = await withDb(url, (db) => db.$count(people, eq(people.tenantId, a)));
    expect(count).toBe(9);
  });

  it("gives one sign-in user per R1 role", async () => {
    const tenantId = await withDb(url, seedDemo);
    const rows = await withDb(url, (db) => db.select().from(users).where(eq(users.tenantId, tenantId)));
    expect(rows.map((u) => u.role).sort()).toEqual(["Council", "Executive", "PM", "RM"]);
  });

  it("reproduces the prototype conflicts, with holidays applied", async () => {
    const tenantId = await withDb(url, seedDemo);
    const [ps, bs, hs] = await withDb(url, (db) =>
      Promise.all([
        db.select().from(people).where(eq(people.tenantId, tenantId)),
        db.select().from(bookings).where(eq(bookings.tenantId, tenantId)),
        db.select().from(holidays).where(eq(holidays.tenantId, tenantId)),
      ]),
    );
    const conflicts = findConflicts(ps.map(toPerson), bs.map(toBooking), weeksFrom(202641, 8), capacityWithHolidays(hs.map(toHoliday)));
    const names = new Map(ps.map((p) => [p.id, p.name]));
    expect(conflicts.map((c) => names.get(c.personId))).toContain("อนันต์ ส.");
    expect(conflicts.length).toBeGreaterThanOrEqual(3);
  });
});
