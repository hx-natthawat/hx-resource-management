import { describe, expect, it } from "vitest";
import { applyEdits, draftToDemand, extract } from "@/modules/integration";
import { SEED_PROJECTS } from "../fixtures/seed";

const ctx = { projects: SEED_PROJECTS, requestedBy: "ณัฐวุฒิ จ.", year: 2026, today: new Date("2026-10-06T00:00:00Z"), newId: () => "d1" };

describe("voice draft (ADR-008)", () => {
  it("is not approvable until every required field is filled", () => {
    const d = extract("ขอ architect ให้ CRM ภาครัฐ สองวันต่อสัปดาห์", ctx);
    expect(draftToDemand(d)).toMatchObject({ ok: false, missing: ["level", "startWeek", "endWeek"] });
  });

  it("marks human corrections as edited and keeps what was heard", () => {
    const d = extract("ขอ architect ซีเนียร์ ให้ CRM ภาครัฐ สองวันต่อสัปดาห์ ปลายตุลาถึงกลางพฤศจิกา", ctx);
    const e = applyEdits(d, { hoursPerWeek: 24 });
    expect(e.hoursPerWeek).toEqual({ value: 24, source: "edited" });
    expect(e.role?.source).not.toBe("edited");
    expect(draftToDemand(e)).toEqual({
      ok: true,
      demand: { projectId: "crm", role: "Solution Architect", level: "Senior", skills: [], hoursPerWeek: 24, startWeek: d.startWeek!.value, endWeek: d.endWeek!.value },
    });
  });

  it("refuses an end before the start and impossible hours", () => {
    const d = extract("ขอ architect ซีเนียร์ ให้ CRM ภาครัฐ สองวันต่อสัปดาห์ ปลายตุลาถึงกลางพฤศจิกา", ctx);
    expect(draftToDemand(applyEdits(d, { endWeek: 202601 }))).toMatchObject({ ok: false, problem: "end_before_start" });
    expect(draftToDemand(applyEdits(d, { hoursPerWeek: 60 }))).toMatchObject({ ok: false, problem: "hours_out_of_range" });
  });
});

describe("period extraction", () => {
  it("starts next month on its first working week (1 Nov 2026 is a Sunday)", () => {
    const d = extract("ขอ QA เต็มเวลา เดือนหน้า", ctx);
    expect(d.startWeek?.value).toBe(202645);
    expect(d.endWeek?.value).toBe(202649);
  });
});
