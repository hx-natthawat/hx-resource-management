import { and, desc, eq, inArray } from "drizzle-orm";
import type { Booking } from "@/modules/booking";
import { capacityWithHolidays, type Holiday, type Person } from "@/modules/people";
import type { Project } from "@/modules/portfolio";
import type { Db } from "./db/client";
import { toBooking, toHoliday, toPerson, toProject } from "./db/mappers";
import { bookings, decisions, holidays, people, projects } from "./db/schema";

export interface Snapshot {
  people: Person[];
  projects: Project[];
  bookings: Booking[];
  holidays: Holiday[];
  capacityOf: ReturnType<typeof capacityWithHolidays>;
}

/** Everything the R1 screens compute from, for one tenant. Released and rejected bookings are left out. */
export async function loadSnapshot(db: Db, tenantId: string): Promise<Snapshot> {
  // One client per request runs one query at a time (pg deprecates overlapping queries on a client).
  const ps = await db.select().from(people).where(eq(people.tenantId, tenantId)).orderBy(people.name);
  const prs = await db.select().from(projects).where(eq(projects.tenantId, tenantId)).orderBy(projects.rank);
  const bs = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.tenantId, tenantId), inArray(bookings.status, ["Draft", "Requested", "Proposed", "Confirmed"])))
    .orderBy(bookings.createdAt);
  const hs = await db.select().from(holidays).where(eq(holidays.tenantId, tenantId)).orderBy(holidays.date);
  const hol = hs.map(toHoliday);
  return { people: ps.map(toPerson), projects: prs.map(toProject), bookings: bs.map(toBooking), holidays: hol, capacityOf: capacityWithHolidays(hol) };
}

export async function recentDecisions(db: Db, tenantId: string, limit = 20) {
  return db.select().from(decisions).where(eq(decisions.tenantId, tenantId)).orderBy(desc(decisions.decidedAt)).limit(limit);
}
