import { describe, expect, it } from "vitest";
import { findConflicts, rankCandidates, recommendResolution, weekLoad } from "@/modules/conflict";
import { moveRank, ranksAreUnique, wsjf } from "@/modules/portfolio";
import { SEED_BOOKINGS, SEED_PEOPLE, SEED_PROJECTS } from "../fixtures/seed";

const anan = SEED_PEOPLE.find((p) => p.id === "p-anan")!;

describe("capacity", () => {
  it("counts hard and soft hours separately", () => {
    const l = weekLoad(anan, SEED_BOOKINGS, 43);
    expect(l).toMatchObject({ hardHours: 40, softHours: 8, percent: 120, hasSoft: true });
  });

  it("ignores requested bookings with no person", () => {
    expect(weekLoad(anan, SEED_BOOKINGS, 41).percent).toBe(60);
  });

  it("finds the seeded conflicts, worst first", () => {
    const c = findConflicts(SEED_PEOPLE, SEED_BOOKINGS);
    expect(c.map((x) => x.personId)).toEqual(["p-wanna", "p-anan", "p-siriporn"]);
    expect(c[1].weeks).toEqual([43, 44]);
  });

  it("recommends shifting the lowest-rank soft booking", () => {
    const c = findConflicts(SEED_PEOPLE, SEED_BOOKINGS).find((x) => x.personId === "p-anan")!;
    const r = recommendResolution(c, SEED_BOOKINGS, SEED_PROJECTS)!;
    const booking = SEED_BOOKINGS.find((b) => b.id === r.bookingId)!;
    expect(booking.projectId).toBe("km");
    expect(r.shiftWeeks).toBe(2);
  });

  it("never recommends someone who would exceed capacity first", () => {
    const req = { ...SEED_BOOKINGS[0], id: "new", personId: null, status: "Requested" as const, role: "Solution Architect" as const, skills: ["Integration", "AWS"], level: "Senior" as const, hoursPerWeek: 16, startWeek: 43, endWeek: 46 };
    const [top] = rankCandidates(req, SEED_PEOPLE, SEED_BOOKINGS);
    expect(top.fits).toBe(true);
    expect(top.person.id).toBe("p-chayapol");
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
