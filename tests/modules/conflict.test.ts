import { describe, expect, it } from "vitest";
import { findConflicts, rankCandidates, recommendResolution, weekLoad } from "@/modules/conflict";
import { addWeeks, capacityWithHolidays, formatWeekRange, weeksBetween, weeksFrom } from "@/modules/people";
import { moveRank, ranksAreUnique, wsjf } from "@/modules/portfolio";
import { SEED_BOOKINGS, SEED_PEOPLE, SEED_PROJECTS } from "../fixtures/seed";

const WEEKS = weeksFrom(202641, 8);

const anan = SEED_PEOPLE.find((p) => p.id === "p-anan")!;

describe("capacity", () => {
  it("counts hard and soft hours separately", () => {
    const l = weekLoad(anan, SEED_BOOKINGS, 202643);
    expect(l).toMatchObject({ hardHours: 40, softHours: 8, percent: 120, hasSoft: true });
  });

  it("ignores requested bookings with no person", () => {
    expect(weekLoad(anan, SEED_BOOKINGS, 202641).percent).toBe(60);
  });

  it("finds the seeded conflicts, worst first", () => {
    const c = findConflicts(SEED_PEOPLE, SEED_BOOKINGS, WEEKS);
    expect(c.map((x) => x.personId)).toEqual(["p-wanna", "p-anan", "p-siriporn"]);
    expect(c[1].weeks).toEqual([202643, 202644]);
  });

  it("counts only confirmed hours as consumed (ADR-002)", () => {
    const l = weekLoad(anan, SEED_BOOKINGS, 202643);
    expect(l.hardPercent).toBe(100);
  });

  it("lowers capacity by one fifth per weekday holiday (ADR-004)", () => {
    const capacityOf = capacityWithHolidays([{ date: "2026-10-13", name: "วันนวมินทรมหาราช" }, { date: "2026-10-24", name: "Saturday, no effect" }]);
    const l = weekLoad(anan, SEED_BOOKINGS, 202642, capacityOf);
    expect(l.capacityHours).toBe(32);
    expect(l.hardPercent).toBe(125);
  });

  it("keeps the higher-ranked project even when its booking is still soft (ADR-003)", () => {
    const bookings = [
      { ...SEED_BOOKINGS[0], id: "hi", projectId: "crm", personId: "p-anan", hoursPerWeek: 24, startWeek: 202650, endWeek: 202650, status: "Proposed" as const },
      { ...SEED_BOOKINGS[0], id: "lo", projectId: "ai", personId: "p-anan", hoursPerWeek: 24, startWeek: 202650, endWeek: 202650, status: "Confirmed" as const },
    ];
    const [c] = findConflicts([anan], bookings, [202650]);
    expect(recommendResolution(c, bookings, SEED_PROJECTS)!.bookingId).toBe("lo");
  });

  it("recommends shifting the lowest-rank booking", () => {
    const c = findConflicts(SEED_PEOPLE, SEED_BOOKINGS, WEEKS).find((x) => x.personId === "p-anan")!;
    const r = recommendResolution(c, SEED_BOOKINGS, SEED_PROJECTS)!;
    const booking = SEED_BOOKINGS.find((b) => b.id === r.bookingId)!;
    expect(booking.projectId).toBe("km");
    expect(r.shiftWeeks).toBe(2);
  });

  it("never recommends someone who would exceed capacity first", () => {
    const req = { ...SEED_BOOKINGS[0], id: "new", personId: null, status: "Requested" as const, role: "Solution Architect" as const, skills: ["Integration", "AWS"], level: "Senior" as const, hoursPerWeek: 16, startWeek: 202643, endWeek: 202646 };
    const [top] = rankCandidates(req, SEED_PEOPLE, SEED_BOOKINGS);
    expect(top.fits).toBe(true);
    expect(top.person.id).toBe("p-chayapol");
  });
});

describe("weeks", () => {
  it("roll over the ISO year", () => {
    expect(addWeeks(202652, 1)).toBe(202653);
    expect(addWeeks(202653, 1)).toBe(202701);
    expect(weeksBetween(202652, 202702)).toEqual([202652, 202653, 202701, 202702]);
  });
  it("format as Thai dates", () => {
    expect(formatWeekRange(202643, 202646)).toBe("19 ต.ค. ถึง 13 พ.ย. (W43 ถึง W46)");
  });
});

describe("rank", () => {
  it("computes WSJF", () => {
    expect(wsjf({ value: 13, timeCriticality: 20, riskReduction: 5, size: 8 })).toBeCloseTo(4.75);
  });
  it("moving keeps ranks unique and contiguous", () => {
    const moved = moveRank(SEED_PROJECTS, "ai", -1);
    expect(ranksAreUnique(moved)).toBe(true);
    expect(moved.find((p) => p.id === "ai")!.rank).toBe(4);
  });
});
