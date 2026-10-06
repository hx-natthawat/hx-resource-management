# HX Resource Management

Production codebase. Every rule below comes from an Accepted ADR in `docs/adr/`.

## How work moves

Research, Analysis, Design and Plan, UX/UI confirmed by Fero, ADR, Develop, Verify, Deliver. A change that contradicts an Accepted ADR needs a new ADR that supersedes it. Never merge to `main` without Fero's approval.

## Product rules

- Mobile first. Build and check every screen at 390 px, then at 1024 px and up. Touch targets at least 44 px, primary actions at least 48 px and pinned above the bottom nav.
- Voice first, human approves (ADR-008). Nothing is saved from voice until a human approves on a review screen. Every extracted field carries its source. Audio is encrypted and deleted after 90 days.
- UI copy is Thai, professional register. Code, identifiers, commits and branches are English.
- Brand tokens are the `hx-*` values in `src/app/globals.css` (HarmonyX Design System). No raw hex in components.
- Approved screens: `prototypes/ui-mobile-first` on branch `prototype/r1-booking-logic`, and the Design canvas https://claude.ai/artifact/397GF7hyiKhAUV6e853b32.

## Commands

```bash
pnpm install
pnpm dev:db         # start or reuse PostgreSQL, migrate, seed demo data, write .env.local (keep it running; rerun after pulling new migrations)
pnpm dev:db --reset # wipe a local database and reseed the demo
pnpm dev            # http://localhost:3000
pnpm lint           # includes the module boundary rule
pnpm typecheck
pnpm test           # unit + PostgreSQL integration (embedded Postgres on macOS if TEST_DATABASE_URL is unset; CI and Linux set TEST_DATABASE_URL)
pnpm build          # Node standalone, used for on-premise Docker
pnpm cf:build       # Cloudflare Workers via OpenNext
pnpm db:generate    # new migration after a schema change
```

## Map

| Path | Owns | ADR |
| --- | --- | --- |
| `src/modules/people`, `portfolio`, `booking`, `conflict`, `integration` | Pure domain logic and types. No framework imports; ESLint enforces it. | 005 |
| `src/modules/booking/state.ts` | Booking state machine. Every status change goes through `transition()`. | 002 |
| `src/modules/conflict/capacity.ts` | Week load (hard and soft), conflicts, candidate ranking, recommended resolution. | 003, 004 |
| `src/modules/integration/voice/extract.ts` | Rule-based Thai extractor. Replace behind `SpeechEngine` and `Extractor`. | 008 |
| `src/server/db/schema.ts` | Drizzle schema. `tenant_id` on every table. Weeks are ISO year × 100 + week (202643). | 004, 005 |
| `src/server/db/client.ts` | One PostgreSQL client per request, never global. | 005 |
| `src/server/booking/confirm.ts` | Confirm a booking inside one transaction with the person's row locked. Idempotent. Writes an audit event. | 006 |
| `src/server/api/app.ts` | Hono app under `/api`. Zod validation at the edge. | 005 |
| `drizzle/` | Migrations. `0001` makes `audit_events` append-only. | 006 |
| `src/server/seed/demo.ts` | Fictional demo tenant matching the prototype. Idempotent. Never run against production. | 005 |
| `src/server/booking/commands.ts` | Demand (Requested, no person), propose (Soft), reject. Each writes an audit event; repeats converge. | 002, 006 |
| `src/server/portfolio/rank.ts` | Save the Portfolio Rank as one ordered list: no ties, reason required when it differs from WSJF, one Decision log entry. | 003 |
| `src/modules/people/week.ts`, `calendar.ts` | Week arithmetic across ISO years; holidays lower weekly capacity by a fifth per weekday. | 004 |
| `tests/modules`, `tests/integration` | Domain tests and real-PostgreSQL tests, including the two-confirmations race. | 006 |

## Not built yet (each is a Feature issue)

- Authentication. Outside production a demo user is picked on /sign-in (cookie `hx_dev_user`); production returns 401 until Google sign-in lands. The SSO feature replaces it with better-auth and Google Workspace, checking the `hd` claim server-side.
- Screens. Port each one from `prototypes/ui-mobile-first` when its feature issue starts, wired to the API instead of the in-memory store.
- Heatmap materialized view, Cron refresh, voice engine, audio retention job.
- Cloudflare: replace `REPLACE_WITH_HYPERDRIVE_ID` in `wrangler.jsonc` and read the Hyperdrive connection string as `DATABASE_URL`.

## Gotchas

- The embedded-postgres Linux binary needs ICU 60, which Ubuntu 24.04 lacks. CI uses a `postgres:16` service; on Linux point `TEST_DATABASE_URL` at a real PostgreSQL.

- pnpm uses `node-linker=hoisted` (`.npmrc`). OpenNext cannot trace `pg-cloudflare` through pnpm's isolated layout.
- `pg` and `pg-cloudflare` are in `serverExternalPackages` so the Workers bundle resolves the Cloudflare socket.
- Hyperdrive has no advisory locks or `LISTEN/NOTIFY`. Use row locks only.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
