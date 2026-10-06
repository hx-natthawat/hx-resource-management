import type { Booking } from "../booking/types";
import type { Person } from "../people/types";
import { addWeeks, weeksBetween } from "../people/week";
import type { Project } from "../portfolio/types";
import { flatCapacity, loadAfter, rankCandidates, recommendResolution, weekLoad, type CapacityOf } from "./capacity";
import type { Conflict, DecisionKind } from "./types";

export interface DecisionChoice {
  bookingId: string;
  kind: DecisionKind;
  /** Required for `substitute`. */
  substituteId?: string;
  /** For `reduce`. Defaults to half the current hours, never below 4. */
  hoursPerWeek?: number;
  reason?: string;
}

export interface BookingChange {
  bookingId: string;
  personId: string | null;
  startWeek: number;
  endWeek: number;
  hoursPerWeek: number;
}

export type DecisionError =
  | "not_in_conflict"
  | "reason_required"
  | "substitute_required"
  | "substitute_unavailable"
  | "invalid_hours"
  | "still_conflicted";

export type DecisionPlan =
  | { ok: true; change: BookingChange; followedRecommendation: boolean; shiftWeeks: number }
  | { ok: false; code: DecisionError; peakPercent?: number };

export const MIN_REASON = 5;

/** Weeks a booking must move so it starts after the last conflicted week. */
export const shiftNeeded = (booking: Booking, conflict: Conflict) =>
  Math.max(1, weeksBetween(booking.startWeek, Math.max(...conflict.weeks)).length);

/**
 * Smallest shift, starting just past the conflict, at which the booking fits the
 * person's capacity again (proposed hours counted), so the fix does not move the
 * conflict a few weeks later. Falls back to the minimum when nothing fits within a year.
 */
export function fitShift(target: Booking, conflict: Conflict, person: Person | undefined, bookings: Booking[], capacityOf: CapacityOf = flatCapacity): number {
  const min = shiftNeeded(target, conflict);
  if (!person) return min;
  const others = bookings.filter((b) => b.id !== target.id);
  for (let n = min; n < min + 52; n++) {
    const moved = { ...target, startWeek: addWeeks(target.startWeek, n), endWeek: addWeeks(target.endWeek, n) };
    if (loadAfter(person, others, moved, { capacityOf }) <= 100) return n;
  }
  return min;
}

/** Default reduction: half the hours, at least 4. */
export const reducedHours = (hours: number) => Math.max(4, Math.round(hours / 2));

/** The best person who could take the booking over without creating a new conflict. */
export function suggestSubstitute(target: Booking, conflictPersonId: string, people: Person[], bookings: Booking[], capacityOf: CapacityOf = flatCapacity) {
  return rankCandidates({ ...target, personId: null }, people.filter((p) => p.id !== conflictPersonId), bookings, capacityOf).find((c) => c.fits);
}

/**
 * Turn a Council choice into one booking change (ADR-003, ADR-006). Following the
 * recommendation means shifting the lowest-ranked project's booking; anything else
 * is an override and needs a reason. A substitute must fit with proposed hours
 * counted, so the fix never creates a new conflict for someone else.
 */
function planChange(
  conflict: Conflict,
  choice: DecisionChoice,
  ctx: { people: Person[]; projects: Project[]; bookings: Booking[]; capacityOf?: CapacityOf },
): DecisionPlan {
  const capacityOf = ctx.capacityOf ?? flatCapacity;
  const target = ctx.bookings.find((b) => b.id === choice.bookingId);
  if (!target || !conflict.bookingIds.includes(target.id)) return { ok: false, code: "not_in_conflict" };

  const rec = recommendResolution(conflict, ctx.bookings, ctx.projects);
  const followedRecommendation = choice.kind === "shift" && rec?.bookingId === target.id;
  if (!followedRecommendation && (choice.reason?.trim().length ?? 0) < MIN_REASON) return { ok: false, code: "reason_required" };

  const base: BookingChange = { bookingId: target.id, personId: target.personId, startWeek: target.startWeek, endWeek: target.endWeek, hoursPerWeek: target.hoursPerWeek };
  const shiftWeeks = fitShift(target, conflict, ctx.people.find((p) => p.id === target.personId), ctx.bookings, capacityOf);

  switch (choice.kind) {
    case "shift":
      return { ok: true, followedRecommendation, shiftWeeks, change: { ...base, startWeek: addWeeks(target.startWeek, shiftWeeks), endWeek: addWeeks(target.endWeek, shiftWeeks) } };
    case "substitute": {
      if (!choice.substituteId) return { ok: false, code: "substitute_required" };
      const sub = ctx.people.find((p) => p.id === choice.substituteId);
      if (!sub || sub.id === conflict.personId) return { ok: false, code: "substitute_unavailable" };
      const c = rankCandidates({ ...target, personId: null }, [sub], ctx.bookings.filter((b) => b.id !== target.id), capacityOf)[0];
      if (!c || !c.fits) return { ok: false, code: "substitute_unavailable", peakPercent: c?.peakAfter };
      return { ok: true, followedRecommendation, shiftWeeks: 0, change: { ...base, personId: sub.id } };
    }
    case "reduce": {
      const hours = choice.hoursPerWeek ?? reducedHours(target.hoursPerWeek);
      if (!Number.isInteger(hours) || hours < 1 || hours >= target.hoursPerWeek) return { ok: false, code: "invalid_hours" };
      return { ok: true, followedRecommendation, shiftWeeks: 0, change: { ...base, hoursPerWeek: hours } };
    }
  }
}

/**
 * Plan a decision, then prove it: the changed booking must sit within capacity
 * (proposed hours counted) everywhere it now lands, or the decision fixed nothing.
 */
export function planDecision(
  conflict: Conflict,
  choice: DecisionChoice,
  ctx: { people: Person[]; projects: Project[]; bookings: Booking[]; capacityOf?: CapacityOf },
): DecisionPlan {
  const plan = planChange(conflict, choice, ctx);
  if (!plan.ok) return plan;
  const owner = ctx.people.find((p) => p.id === plan.change.personId);
  if (!owner) return plan;
  const after = ctx.bookings.map((b) => (b.id === plan.change.bookingId ? { ...b, ...plan.change, id: b.id } : b));
  const peak = Math.max(...weeksBetween(plan.change.startWeek, plan.change.endWeek).map((w) => weekLoad(owner, after, w, ctx.capacityOf ?? flatCapacity).percent));
  return peak > 100 ? { ok: false, code: "still_conflicted", peakPercent: peak } : plan;
}
