import { describe, expect, it } from "vitest";
import { extract, missing, nextQuestion } from "@/modules/integration";
import { weekOfDate } from "@/modules/people";
import { SEED_PROJECTS } from "../fixtures/seed";

const ctx = { projects: SEED_PROJECTS, requestedBy: "ณัฐวุฒิ จ.", year: 2026, today: new Date(Date.UTC(2026, 9, 6)), newId: () => "d1" };

describe("voice extraction", () => {
  it("fills what it heard and asks for the missing level", () => {
    const d = extract("ขอ architect สายระบบ integration ให้โปรเจกต์ CRM ภาครัฐ สักสองวันต่อสัปดาห์ ช่วงปลายเดือนตุลาถึงกลางพฤศจิกา", ctx);
    expect(d.role?.value).toBe("Solution Architect");
    expect(d.projectId?.value).toBe("crm");
    expect(d.hoursPerWeek).toMatchObject({ value: 16, source: "inferred" });
    expect(d.startWeek?.value).toBe(weekOfDate(new Date(Date.UTC(2026, 9, 21))));
    expect(d.endWeek?.value).toBe(weekOfDate(new Date(Date.UTC(2026, 10, 20))));
    expect(missing(d)).toEqual(["level"]);
    expect(nextQuestion(d)).toContain("Senior");
  });

  it("merges a follow-up answer into the same draft", () => {
    const first = extract("ขอ architect ให้ CRM ภาครัฐ สองวันต่อสัปดาห์ ปลายตุลาถึงกลางพฤศจิกา", ctx);
    const d = extract("ซีเนียร์ เน้น AWS ด้วย", ctx, first);
    expect(d.level?.value).toBe("Senior");
    expect(d.skills?.value).toContain("AWS");
    expect(d.transcript).toHaveLength(2);
    expect(missing(d)).toEqual([]);
  });

  it("does not mistake devops for developer", () => {
    expect(extract("ขอ devops ครึ่งเวลา", ctx).role?.value).toBe("DevOps Engineer");
  });
});
