import type { Person } from "./types";
import { weekOfDate, type Week } from "./week";

/** A non-working day for everyone in the tenant, such as a Thai public holiday. */
export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

const isWeekday = (d: Date) => d.getUTCDay() >= 1 && d.getUTCDay() <= 5;

/** Weekday holidays per week. A holiday on a weekend takes no hours; its substitute day is a separate entry. */
export function holidayDaysByWeek(holidays: Holiday[]): Map<Week, number> {
  const out = new Map<Week, number>();
  for (const h of holidays) {
    const d = new Date(`${h.date}T00:00:00Z`);
    if (!isWeekday(d)) continue;
    const w = weekOfDate(d);
    out.set(w, (out.get(w) ?? 0) + 1);
  }
  return out;
}

/** Capacity after holidays: each weekday holiday removes one fifth of the weekly hours (ADR-004). */
export function capacityWithHolidays(holidays: Holiday[]) {
  const days = holidayDaysByWeek(holidays);
  return (person: Person, week: Week) => Math.max(0, Math.round(person.capacityHours * (1 - (days.get(week) ?? 0) / 5)));
}

export const holidaysInWeek = (holidays: Holiday[], week: Week) =>
  holidays.filter((h) => {
    const d = new Date(`${h.date}T00:00:00Z`);
    return isWeekday(d) && weekOfDate(d) === week;
  });

