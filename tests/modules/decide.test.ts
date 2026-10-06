import { describe, expect, it } from "vitest";
import { findConflicts, planDecision, recommendResolution, suggestSubstitute } from "@/modules/conflict";
import { weeksFrom } from "@/modules/people";
import { SEED_BOOKINGS, SEED_PEOPLE, SEED_PROJECTS } from "../fixtures/seed";

const ctx = { people: SEED_PEOPLE, projects: SEED_PROJECTS, bookings: SEED_BOOKINGS };
const anan = findConflicts(SEED_PEOPLE, SEED_BOOKINGS, weeksFrom(202641, 8)).find((c) => c.personId === "p-anan")!;
const km = SEED_BOOKINGS.find((b) => b.personId === "p-anan" && b.projectId === "km")!;
const crm = SEED_BOOKINGS.find((b) => b.personId === "p-anan" && b.projectId === "crm")!;

describe("planDecision (ADR-003)", () => {
  it("recommends the lowest-ranked booking and shifts it to the first weeks it fits", () => {
    expect(recommendResolution(anan, SEED_BOOKINGS, SEED_PROJECTS)?.bookingId).toBe(km.id);
    const plan = planDecision(anan, { bookingId: km.id, kind: "shift" }, ctx);
    expect(plan).toMatchObject({ ok: true, followedRecommendation: true, shiftWeeks: 4, change: { startWeek: 202647, endWeek: 202648, personId: "p-anan" } });
  });

  it("the shifted plan clears the conflict", () => {
    const plan = planDecision(anan, { bookingId: km.id, kind: "shift" }, ctx);
    if (!plan.ok) throw new Error(plan.code);
    const after = SEED_BOOKINGS.map((b) => (b.id === km.id ? { ...b, startWeek: plan.change.startWeek, endWeek: plan.change.endWeek } : b));
    expect(findConflicts(SEED_PEOPLE, after, weeksFrom(202641, 8)).some((c) => c.personId === "p-anan")).toBe(false);
  });

  it("requires a reason to move the higher-ranked project instead", () => {
    expect(planDecision(anan, { bookingId: crm.id, kind: "shift" }, ctx)).toEqual({ ok: false, code: "reason_required" });
    expect(planDecision(anan, { bookingId: crm.id, kind: "shift", reason: "ลูกค้า CRM เลื่อน UAT" }, ctx)).toMatchObject({ ok: true, followedRecommendation: false });
  });

  it("treats substitute and reduce as overrides that need a reason", () => {
    expect(planDecision(anan, { bookingId: km.id, kind: "reduce" }, ctx)).toEqual({ ok: false, code: "reason_required" });
    expect(planDecision(anan, { bookingId: crm.id, kind: "reduce", reason: "ลดขอบเขตงาน" }, ctx)).toMatchObject({ ok: true, change: { hoursPerWeek: 12 } });
  });

  it("refuses a decision that leaves the person over capacity", () => {
    // 24 + 16 + 4 = 44 of 40 hours: halving the small booking does not clear the conflict.
    expect(planDecision(anan, { bookingId: km.id, kind: "reduce", reason: "ลดขอบเขตงาน" }, ctx)).toEqual({ ok: false, code: "still_conflicted", peakPercent: 110 });
  });

  it("only substitutes someone who fits without a new conflict", () => {
    const sub = suggestSubstitute(km, "p-anan", SEED_PEOPLE, SEED_BOOKINGS);
    expect(sub?.person.id).toBe("p-chayapol");
    expect(planDecision(anan, { bookingId: km.id, kind: "substitute", substituteId: "p-chayapol", reason: "ชยพลว่าง" }, ctx)).toMatchObject({ ok: true, change: { personId: "p-chayapol" } });
    const bigCrm = { ...crm, hoursPerWeek: 24 };
    expect(planDecision(anan, { bookingId: bigCrm.id, kind: "substitute", substituteId: "p-chayapol", reason: "ทดสอบเกิน" }, ctx)).toMatchObject({ ok: false, code: "substitute_unavailable", peakPercent: 120 });
    expect(planDecision(anan, { bookingId: km.id, kind: "substitute", substituteId: "p-anan", reason: "ตัวเอง" }, ctx)).toMatchObject({ ok: false, code: "substitute_unavailable" });
    expect(planDecision(anan, { bookingId: km.id, kind: "substitute", reason: "ไม่ระบุ" }, ctx)).toEqual({ ok: false, code: "substitute_required" });
  });

  it("rejects a booking outside the conflict and hours that do not reduce", () => {
    const other = SEED_BOOKINGS.find((b) => b.personId === "p-pim")!;
    expect(planDecision(anan, { bookingId: other.id, kind: "shift" }, ctx)).toEqual({ ok: false, code: "not_in_conflict" });
    expect(planDecision(anan, { bookingId: km.id, kind: "reduce", hoursPerWeek: 8, reason: "ไม่ลดจริง" }, ctx)).toEqual({ ok: false, code: "invalid_hours" });
  });
});
