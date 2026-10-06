import { describe, expect, it } from "vitest";
import { findConflicts, planDecision } from "@/modules/conflict";
import { capacityWithHolidays, weeksBetween } from "@/modules/people";
import type { Booking } from "@/modules/booking/types";
import type { Person } from "@/modules/people/types";
import type { Project } from "@/modules/portfolio/types";

const anan = { id: "a", name: "A", role: "Solution Architect", level: "Senior", skills: ["X"], capacityHours: 40, wipLimit: 3, isKeyResource: false, company: "HX" } as unknown as Person;
const projects = [{ id: "hi", rank: 2 }, { id: "lo", rank: 5 }] as unknown as Project[];
const bk = (id: string, projectId: string, status: string, startWeek: number, endWeek: number, hoursPerWeek: number) =>
  ({ id, projectId, personId: "a", role: "Solution Architect", level: "Senior", skills: ["X"], status, startWeek, endWeek, hoursPerWeek }) as unknown as Booking;

describe("verifier: still_conflicted post-check", () => {
  it("a reduce that clears every week it can is not refused because of a holiday week the low booking cannot fix", () => {
    // W46 has 3 weekday holidays -> capacity 16; the rank-2 booking alone is 24h (150%) there.
    const capacityOf = capacityWithHolidays([{ date: "2026-11-10", name: "h" }, { date: "2026-11-11", name: "h" }, { date: "2026-11-12", name: "h" }]);
    const bookings = [bk("hi", "hi", "Confirmed", 202643, 202648, 24), bk("lo", "lo", "Proposed", 202643, 202646, 24)];
    const c = findConflicts([anan], bookings, weeksBetween(202643, 202648), capacityOf)[0];
    expect(c.weeks).toEqual([202643, 202644, 202645, 202646]);
    const plan = planDecision(c, { bookingId: "lo", kind: "reduce", hoursPerWeek: 12, reason: "ลดขอบเขต" }, { people: [anan], projects, bookings, capacityOf });
    // 43-45 go from 120% to 90%; 46 stays over only because of the rank-2 booking.
    expect(plan).toMatchObject({ ok: true });
  });
});
