# PROTOTYPE: R1 screens (#18)

Throwaway. Lives only on branch `prototype/r1-booking-logic`. Never merge to `main`.

**Run:** `pnpm prototype:ui`, then open http://localhost:5178/r1-booking-ui/?variant=A
(Node 23.6+, no install. The server strips TypeScript types so the browser imports `../r1-booking-logic/logic.ts` directly.)

**Question.** Which R1 screen shape should be the home for the people who use it most?

| Variant | Built for | Primary affordance |
| --- | --- | --- |
| A, RM console | Resource Manager | Capacity heatmap. Pick a request, click a person, see the impact before confirming. |
| B, Booking pipeline | PM and RM | Kanban by booking state. Conflicts sit as banners above the columns. |
| C, Council inbox | Resource Council and Executive | Conflicts first, with the week-by-week clash, plus the Portfolio Rank list. |

Switch with the floating bar or the ← → keys. "Load scenario…" replays the same five cases as the terminal app.
All three share one in-memory state and the same rules in `logic.ts`.
