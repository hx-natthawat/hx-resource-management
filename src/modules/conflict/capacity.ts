import { isHard, isSoft, occupiesCapacity } from "../booking/state";
import type { Booking } from "../booking/types";
import type { Person } from "../people/types";
import { weeksBetween, type Week } from "../people/week";
import type { Project } from "../portfolio/types";
import type { Conflict } from "./types";

/** Hours a person can work in a week. Holidays and leave lower it (ADR-004). */
export type CapacityOf = (person: Person, week: Week) => number;
export const flatCapacity: CapacityOf = (person) => person.capacityHours;

const covers = (b: Pick<Booking, "startWeek" | "endWeek">, week: Week) => week >= b.startWeek && week <= b.endWeek;
const pct = (hours: number, capacity: number) => (capacity <= 0 ? (hours > 0 ? Infinity : 0) : Math.round((hours / capacity) * 100));

export interface WeekLoad {
  week: Week;
  capacityHours: number;
  hardHours: number;
  softHours: number;
  /** Confirmed hours only. Only Hard bookings consume capacity (ADR-002). */
  hardPercent: number;
  /** Confirmed plus proposed. Above 100 means a conflict is forming. */
  percent: number;
  hasSoft: boolean;
}

export function weekLoad(person: Person, bookings: Booking[], week: Week, capacityOf: CapacityOf = flatCapacity): WeekLoad {
  const mine = bookings.filter((b) => b.personId === person.id && covers(b, week));
  const hardHours = mine.filter(isHard).reduce((s, b) => s + b.hoursPerWeek, 0);
  const softHours = mine.filter(isSoft).reduce((s, b) => s + b.hoursPerWeek, 0);
  const capacityHours = capacityOf(person, week);
  return {
    week,
    capacityHours,
    hardHours,
    softHours,
    hardPercent: pct(hardHours, capacityHours),
    percent: pct(hardHours + softHours, capacityHours),
    hasSoft: softHours > 0,
  };
}

type Span = Pick<Booking, "hoursPerWeek" | "startWeek" | "endWeek">;

/** Peak percent over the span if `extra` were added. `count` decides which existing bookings take room. */
export function loadAfter(person: Person, bookings: Booking[], extra: Span, opts: { count?: "hard" | "hardAndSoft"; capacityOf?: CapacityOf } = {}): number {
  const count = opts.count ?? "hardAndSoft";
  const capacityOf = opts.capacityOf ?? flatCapacity;
  let peak = 0;
  for (const w of weeksBetween(extra.startWeek, extra.endWeek)) {
    const l = weekLoad(person, bookings, w, capacityOf);
    const used = count === "hard" ? l.hardHours : l.hardHours + l.softHours;
    peak = Math.max(peak, pct(used + extra.hoursPerWeek, l.capacityHours));
  }
  return peak;
}

export function activeProjectCount(person: Person, bookings: Booking[], week: Week): number {
  return new Set(bookings.filter((b) => b.personId === person.id && occupiesCapacity(b) && covers(b, week)).map((b) => b.projectId)).size;
}

/** A conflict is any person-week where confirmed plus proposed hours exceed capacity. Worst first. */
export function findConflicts(people: Person[], bookings: Booking[], weeks: Week[], capacityOf: CapacityOf = flatCapacity): Conflict[] {
  const out: Conflict[] = [];
  for (const p of people) {
    const over = weeks.map((w) => weekLoad(p, bookings, w, capacityOf)).filter((l) => l.percent > 100);
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

/** Suggest people for a request. Conservative: proposed hours count, so a suggestion never collides with pending work. */
export function rankCandidates(request: Booking, people: Person[], bookings: Booking[], capacityOf: CapacityOf = flatCapacity): Candidate[] {
  const others = bookings.filter((b) => b.id !== request.id);
  return people
    .filter((p) => p.role === request.role || p.skills.some((s) => request.skills.includes(s)))
    .map((person) => {
      const matched = request.skills.filter((s) => person.skills.includes(s)).length;
      const skillMatch = request.skills.length ? matched / request.skills.length : 1;
      const peakAfter = loadAfter(person, others, request, { capacityOf });
      const overWip = activeProjectCount(person, others, request.startWeek) >= person.wipLimit;
      const fits = peakAfter <= 100 && !overWip;
      const levelOk = levelValue[person.level] >= levelValue[request.level] ? 1 : 0;
      const score = (fits ? 100 : 0) + skillMatch * 40 + levelOk * 20 + (person.role === request.role ? 10 : 0) - Math.min(peakAfter, 1000) / 10;
      return { person, skillMatch, peakAfter, fits, overWip, score };
    })
    .sort((a, b) => b.score - a.score);
}

export interface Resolution {
  bookingId: string;
  kind: "shift";
  shiftWeeks: number;
}

/**
 * ADR-003: the higher-ranked project keeps the person. Recommend moving the booking of the
 * lowest-ranked project out past the conflict; among equal ranks, a soft booking moves first.
 */
export function recommendResolution(conflict: Conflict, bookings: Booking[], projects: Project[]): Resolution | null {
  const rankOf = (id: string) => projects.find((p) => p.id === id)?.rank ?? Number.MAX_SAFE_INTEGER;
  const involved = bookings.filter((b) => conflict.bookingIds.includes(b.id));
  const loser = [...involved].sort((a, b) => {
    const byRank = rankOf(b.projectId) - rankOf(a.projectId);
    return byRank !== 0 ? byRank : Number(isSoft(b)) - Number(isSoft(a));
  })[0];
  if (!loser) return null;
  const lastConflictWeek = Math.max(...conflict.weeks);
  return { bookingId: loser.id, kind: "shift", shiftWeeks: Math.max(1, weeksBetween(loser.startWeek, lastConflictWeek).length) };
}
