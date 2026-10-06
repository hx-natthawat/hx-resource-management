import { isHard, isSoft, occupiesCapacity } from "./booking";
import type { Booking, Conflict, Person, Project, Week } from "./types";

export const WEEKS: Week[] = [41, 42, 43, 44, 45, 46, 47, 48];
export const CURRENT_WEEK: Week = 41;

const covers = (b: Booking, week: Week) => week >= b.startWeek && week <= b.endWeek;

export interface WeekLoad {
  week: Week;
  hardHours: number;
  softHours: number;
  percent: number;
  hasSoft: boolean;
}

export function weekLoad(person: Person, bookings: Booking[], week: Week): WeekLoad {
  const mine = bookings.filter((b) => b.personId === person.id && covers(b, week));
  const hardHours = mine.filter(isHard).reduce((s, b) => s + b.hoursPerWeek, 0);
  const softHours = mine.filter(isSoft).reduce((s, b) => s + b.hoursPerWeek, 0);
  return {
    week,
    hardHours,
    softHours,
    percent: Math.round(((hardHours + softHours) / person.capacityHours) * 100),
    hasSoft: softHours > 0,
  };
}

export function loadAfter(person: Person, bookings: Booking[], extra: Pick<Booking, "hoursPerWeek" | "startWeek" | "endWeek">): number {
  let peak = 0;
  for (let w = extra.startWeek; w <= extra.endWeek; w++) {
    const base = weekLoad(person, bookings, w);
    const pct = Math.round(((base.hardHours + base.softHours + extra.hoursPerWeek) / person.capacityHours) * 100);
    peak = Math.max(peak, pct);
  }
  return peak;
}

export function activeProjectCount(person: Person, bookings: Booking[], week: Week): number {
  return new Set(bookings.filter((b) => b.personId === person.id && occupiesCapacity(b) && covers(b, week)).map((b) => b.projectId)).size;
}

export function findConflicts(people: Person[], bookings: Booking[], weeks: Week[] = WEEKS): Conflict[] {
  const out: Conflict[] = [];
  for (const p of people) {
    const over = weeks.map((w) => weekLoad(p, bookings, w)).filter((l) => l.percent > 100);
    if (over.length === 0) continue;
    const weekSet = over.map((l) => l.week);
    const ids = bookings
      .filter((b) => b.personId === p.id && occupiesCapacity(b) && weekSet.some((w) => covers(b, w)))
      .map((b) => b.id);
    out.push({ personId: p.id, weeks: weekSet, peakPercent: Math.max(...over.map((l) => l.percent)), bookingIds: ids });
  }
  return out.sort((a, b) => b.peakPercent - a.peakPercent);
}

export interface Candidate {
  person: Person;
  skillMatch: number;
  peakAfter: number;
  fits: boolean;
  overWip: boolean;
  score: number;
}

const levelValue = { Junior: 1, Mid: 2, Senior: 3 } as const;

export function rankCandidates(request: Booking, people: Person[], bookings: Booking[]): Candidate[] {
  const others = bookings.filter((b) => b.id !== request.id);
  return people
    .filter((p) => p.role === request.role || p.skills.some((s) => request.skills.includes(s)))
    .map((person) => {
      const matched = request.skills.filter((s) => person.skills.includes(s)).length;
      const skillMatch = request.skills.length ? matched / request.skills.length : 1;
      const peakAfter = loadAfter(person, others, request);
      const overWip = activeProjectCount(person, others, request.startWeek) >= person.wipLimit;
      const fits = peakAfter <= 100 && !overWip;
      const levelOk = levelValue[person.level] >= levelValue[request.level] ? 1 : 0;
      const score = (fits ? 100 : 0) + skillMatch * 40 + levelOk * 20 + (person.role === request.role ? 10 : 0) - peakAfter / 10;
      return { person, skillMatch, peakAfter, fits, overWip, score };
    })
    .sort((a, b) => b.score - a.score);
}

export interface Resolution {
  bookingId: string;
  kind: "shift";
  shiftWeeks: number;
}

export function recommendResolution(conflict: Conflict, bookings: Booking[], projects: Project[]): Resolution | null {
  const rankOf = (id: string) => projects.find((p) => p.id === id)?.rank ?? Number.MAX_SAFE_INTEGER;
  const involved = bookings.filter((b) => conflict.bookingIds.includes(b.id));
  const lowest = [...involved].sort((a, b) => {
    const soft = Number(isSoft(b)) - Number(isSoft(a));
    return soft !== 0 ? soft : rankOf(b.projectId) - rankOf(a.projectId);
  })[0];
  if (!lowest) return null;
  const lastConflictWeek = Math.max(...conflict.weeks);
  return { bookingId: lowest.id, kind: "shift", shiftWeeks: Math.max(1, lastConflictWeek - lowest.startWeek + 1) };
}
