import { describe, expect, it } from "vitest";
import { transition } from "@/lib/domain/booking";
import type { Booking } from "@/lib/domain/types";

const base: Booking = {
  id: "b1", projectId: "crm", role: "Developer", skills: [], level: "Mid", personId: null,
  hoursPerWeek: 8, startWeek: 41, endWeek: 42, status: "Draft", requestedBy: "pm", source: "form",
};

describe("booking state machine", () => {
  it("walks the happy path Draft to Released", () => {
    const steps = [{ type: "submit" }, { type: "propose", personId: "p1" }, { type: "confirm" }, { type: "release" }] as const;
    let b = base;
    for (const e of steps) {
      const r = transition(b, e);
      expect(r.ok).toBe(true);
      if (r.ok) b = r.booking;
    }
    expect(b.status).toBe("Released");
    expect(b.personId).toBe("p1");
  });

  it("refuses to confirm a booking that was never proposed", () => {
    const r = transition({ ...base, status: "Requested" }, { type: "confirm" });
    expect(r.ok).toBe(false);
  });

  it("withdrawing a proposal clears the person", () => {
    const r = transition({ ...base, status: "Proposed", personId: "p1" }, { type: "withdrawProposal" });
    expect(r.ok && r.booking.personId).toBe(null);
  });
});
