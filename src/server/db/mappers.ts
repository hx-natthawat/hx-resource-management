import type { Booking } from "@/modules/booking";
import type { Holiday, Person } from "@/modules/people";
import type { Project } from "@/modules/portfolio";
import type { bookings, holidays, people, projects } from "./schema";

export const toPerson = (p: typeof people.$inferSelect): Person => ({
  id: p.id,
  name: p.name,
  role: p.role as Person["role"],
  company: p.company as Person["company"],
  level: p.level as Person["level"],
  skills: p.skills,
  capacityHours: p.capacityHours,
  isKeyResource: p.isKeyResource,
  wipLimit: p.wipLimit,
});

export const toProject = (p: typeof projects.$inferSelect): Project => ({
  id: p.id,
  name: p.name,
  client: p.client,
  status: p.status as Project["status"],
  rank: p.rank,
  wsjf: p.wsjf as Project["wsjf"],
  winProbability: p.winProbability === null ? undefined : Number(p.winProbability),
  rankNote: p.rankNote ?? undefined,
});

export const toBooking = (b: typeof bookings.$inferSelect): Booking => ({
  id: b.id,
  projectId: b.projectId,
  role: b.role as Booking["role"],
  skills: b.skills,
  level: b.level as Booking["level"],
  personId: b.personId,
  hoursPerWeek: b.hoursPerWeek,
  startWeek: b.startWeek,
  endWeek: b.endWeek,
  status: b.status,
  requestedBy: b.requestedBy,
  note: b.note ?? undefined,
  source: b.source,
});

export const toHoliday = (h: typeof holidays.$inferSelect): Holiday => ({ date: h.date, name: h.name });
