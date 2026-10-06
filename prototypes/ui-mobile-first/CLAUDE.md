# HX Resource Management · prototype

This is the approved UX/UI turned into running code. It is the starting point for production work, not production itself.

## Rules for every change

- Follow the `/hx-po` lifecycle: Research, Analysis, Design (UX/UI first, confirmed by Fero), ADR, Develop, Verify, Deliver.
- No production code before the governing ADR is Accepted. ADRs live in `docs/adr/` at the repo root (branch `adr/0001-0007-import` until merged). All seven are still **Proposed**.
- Mobile first. Design and test at 390 px wide first, then `lg` (1024 px) for the desktop layout. Touch targets at least 44 px, primary actions at least 48 px, pinned above the bottom nav.
- Voice is the primary input. Forms are the fallback. Nothing is saved until a human approves on a review screen.
- UI copy is Thai (professional register). Code, identifiers, commits, branches and issue titles are English.
- Brand is HarmonyX (harmonyx.co). Use the `hx-*` tokens in `app/globals.css`; never raw hex in components.

## Commands

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest, domain logic
npm run typecheck
npm run build
```

## Map

| Path | What it owns |
| --- | --- |
| `lib/domain/types.ts` | The data shape. Person, Project, Booking (Draft, Requested, Proposed, Confirmed, Released, Rejected), Conflict, Decision. |
| `lib/domain/booking.ts` | Booking state machine. Every status change goes through `transition()`. |
| `lib/domain/capacity.ts` | Pure capacity math: week load (hard vs soft), conflicts, candidate ranking, recommended resolution. |
| `lib/domain/rank.ts` | WSJF and Portfolio Rank moves. Ranks stay unique. |
| `lib/voice/extract.ts` | Thai utterance to Demand draft, with per-field source (heard, inferred, account, edited) and the next question to ask. |
| `lib/voice/useSpeech.ts` | Browser Web Speech API, `th-TH`, press-and-hold. |
| `lib/state/store.tsx` | In-memory store (React context + reducer) seeded from `lib/state/seed.ts`. |
| `components/AppShell.tsx` | Bottom tab bar with centre mic on mobile, sidebar on `lg`, role switcher, toast. |
| `app/*/page.tsx` | One route per approved screen: `/`, `/voice`, `/review`, `/approve`, `/capacity`, `/conflicts`, `/portfolio`, `/demand`. |
| `tests/` | Domain tests. Keep capacity and conflict logic at 90% coverage or more. |

## What is a stand-in (replace before production)

| Stand-in | Replace with | Decided by |
| --- | --- | --- |
| In-memory store, resets on reload | API (NestJS) + PostgreSQL, conflict check inside the booking transaction | ADR-005, ADR-006 |
| Rule-based Thai extractor | Speech-to-text engine + LLM structured extraction, same `DemandDraft` shape | ADR-008 (to be written) |
| Browser Web Speech API | Server or vendor STT that works on iOS Safari and stores audio per PDPA | ADR-008 |
| Role switcher | Google Workspace SSO + RBAC | ADR-005 |
| Pipeline projects counted at full hours | Weight soft bookings by win probability | Open question |

## Source of truth

- Research, design and ADRs: https://claude.ai/code/artifact/967e47fc-e50a-433e-b9d1-0a68bda3efe3
- Approved UX/UI canvas (13 screens, Mobile First row is primary): https://claude.ai/artifact/397GF7hyiKhAUV6e853b32
- Repo: https://github.com/hx-natthawat/hx-resource-management · Board: GitHub Project 4 (`hx-natthawat`)
