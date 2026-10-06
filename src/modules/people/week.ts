/**
 * A week is ISO year × 100 + ISO week number: 2026-W43 is 202643.
 * Ranges compare as plain numbers; stepping must go through addWeeks because
 * week 52 or 53 rolls over to week 1 of the next year.
 */
export type Week = number;

export const weekOf = (isoYear: number, isoWeekNo: number): Week => isoYear * 100 + isoWeekNo;
export const isoYearOf = (w: Week) => Math.floor(w / 100);
export const isoWeekNoOf = (w: Week) => w % 100;

/** Monday 00:00 UTC of the given week. */
export function mondayOf(w: Week): Date {
  const year = isoYearOf(w);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (isoWeekNoOf(w) - 1) * 7);
  return monday;
}

export function weekOfDate(date: Date): Week {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const no = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekOf(isoYear, no);
}

export function addWeeks(w: Week, n: number): Week {
  const d = mondayOf(w);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return weekOfDate(d);
}

/** Inclusive list of weeks from start to end. Empty when end is before start. */
export function weeksBetween(start: Week, end: Week): Week[] {
  const out: Week[] = [];
  for (let w = start; w <= end; w = addWeeks(w, 1)) out.push(w);
  return out;
}

export const weeksFrom = (start: Week, count: number): Week[] => Array.from({ length: count }, (_, i) => addWeeks(start, i));

const THAI_MONTH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thaiDay = (d: Date) => `${d.getUTCDate()} ${THAI_MONTH_SHORT[d.getUTCMonth()]}`;

export const weekLabel = (w: Week) => `W${isoWeekNoOf(w)}`;

/** "19 ต.ค. ถึง 13 พ.ย. (W43 ถึง W46)", Monday of the first week to Friday of the last. */
export function formatWeekRange(start: Week, end: Week): string {
  const friday = mondayOf(end);
  friday.setUTCDate(friday.getUTCDate() + 4);
  return `${thaiDay(mondayOf(start))} ถึง ${thaiDay(friday)} (${weekLabel(start)} ถึง ${weekLabel(end)})`;
}
