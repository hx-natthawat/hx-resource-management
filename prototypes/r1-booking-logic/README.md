# PROTOTYPE: R1 booking and conflict rules (#18)

Throwaway. Lives only on branch `prototype/r1-booking-logic`. Never merge to `main`.

**Run:** `pnpm prototype:booking` (Node 23.6+ runs the `.ts` files directly, no install).

**Question.** Do ADR-002 (Demand → Soft → Hard), ADR-003 (rank wins, Council exception),
ADR-004 (hours per week, WIP limit 2 for Key Resources) and ADR-006 (capacity check at confirm)
hold together for races, rank preemption, holiday drops and Council exceptions?

**Files.**
- `logic.ts` is pure `(state, input) => { state, error? }`. It is the part worth lifting into the real `booking` and `conflict` modules once the ADRs are accepted.
- `scenarios.ts` holds five scripted cases (keys 1 to 5 in the app).
- `tui.ts` is the throwaway shell.

**Findings.** See issue #18.
