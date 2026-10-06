# ADR-005: Architecture and stack

## Status

Proposed. Issue #5.

Fero decided in chat on 2026-10-06 that the system is a modular monolith in one repository, signs in with Google Workspace, runs in the cloud on Cloudflare, and can be lifted out to run on-premise. Those points are settled. This revision adds the concrete runtime that satisfies them. It replaces NestJS, which the original proposal named, so it needs Fero's acceptance before any production code.

## Context

ผู้ใช้ในหลักร้อยคน ทีมพัฒนาเล็ก ต้องส่งมอบเร็วและต่อยอดเป็น multi-tenant ได้ภายหลัง HarmonyX ใช้ Google Workspace อยู่แล้ว และต้องการวางระบบบน Cloudflare โดยถอดออกไปรัน on-premise ได้

ADR-006 requires real PostgreSQL transactions with row locks (`SELECT ... FOR UPDATE`), a materialized view for the heatmap, and an append-only audit log.

Research findings (2026-10-06):

- NestJS is not practical on Cloudflare Workers. Its dependency injection needs `emitDecoratorMetadata`, which the Workers bundler (esbuild) does not emit. It would only run inside Cloudflare Containers.
- Next.js runs on Workers through `@opennextjs/cloudflare` (supports Next 16, Node runtime). Cloudflare's newer adapter, vinext, is still beta.
- Hyperdrive pools PostgreSQL in transaction mode, so a whole `BEGIN ... FOR UPDATE ... COMMIT` holds one connection. It does not support advisory locks, `LISTEN/NOTIFY`, or SQL-level `PREPARE`. Its read cache does not invalidate on writes.
- Hyperdrive reaches Neon, Supabase, Aurora, and self-hosted PostgreSQL, including a private database through Cloudflare Tunnel.
- better-auth and Auth.js both run on Workers and on Node and support Google. Google states the `hd` request parameter is only a hint; the server must check the `hd` claim in the signed ID token.

Options considered:

1. **Next.js only, API as Hono inside it, on Workers via OpenNext.** One deployable. Same code runs as a Node server on-premise.
2. **Original Next.js + NestJS images in Cloudflare Containers.** Best image portability. Adds cold starts, a Worker and Durable Object routing layer, and two deployables.
3. **Microservices across several repositories.** Rejected by Fero.
4. **Do nothing** (spreadsheets and direct asks). Rejected by ADR-001.

## Decision

Option 1.

- **Shape.** Modular monolith in one pnpm repository. One deployable: Next.js (App Router). Domain modules `people`, `portfolio`, `booking`, `conflict`, `reporting`, `integration` are plain TypeScript packages with no framework imports. Module boundaries are enforced by lint rules.
- **API.** Hono app mounted under `/api` through one catch-all route handler. Input validated at the edge with Zod.
- **Data.** PostgreSQL. Drizzle ORM with the `pg` driver. One database client per request, never global. `tenant_id` on every table from the start.
- **Auth.** better-auth with Google Workspace. Server checks the `hd` claim against the company domain. Roles PM, Resource Manager, Council, Executive, Admin enforced by RBAC in the API.
- **Cloud.** Cloudflare Workers via `@opennextjs/cloudflare`. Hyperdrive to a managed PostgreSQL, with caching off for the write path. Cron Trigger refreshes the heatmap view.
- **On-premise.** `next build` in standalone mode inside Docker with a direct `pg` pool to a local PostgreSQL. Same code, different database injection.
- **CI.** GitHub Actions runs lint, typecheck, and tests on every pull request.

## Consequences

Positive:

- One repository, one deployable, one language. Fits a small team.
- The same build runs on Cloudflare and on a company server.
- Real PostgreSQL semantics stay available for ADR-006.
- Workers Paid starts at 5 USD per month plus usage, small at our scale.

Negative and what becomes harder:

- We give up NestJS dependency injection and modules. Boundaries rely on lint rules and code review.
- OpenNext lags new Next.js releases, and Cloudflare is moving to vinext. Expect one migration later.
- No advisory locks, no `LISTEN/NOTIFY`, no long-lived connections. Real-time updates need polling or Durable Objects.
- Worker bundle size limits must be watched in CI.
- PostgreSQL is not hosted by Cloudflare. We still pick a provider (Neon, Supabase, or self-hosted through Tunnel).
- Cloudflare Access is optional as an outer layer only, so on-premise does not depend on it.

Sources:
[Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) ·
[OpenNext Cloudflare](https://opennext.js.org/cloudflare) ·
[vinext](https://github.com/cloudflare/vinext) ·
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/) ·
[Node http on Workers](https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/) ·
[Containers](https://developers.cloudflare.com/containers/) ·
[How Hyperdrive works](https://developers.cloudflare.com/hyperdrive/concepts/how-hyperdrive-works/) ·
[Hyperdrive supported features](https://developers.cloudflare.com/hyperdrive/reference/supported-databases-and-features/) ·
[Hyperdrive private database](https://developers.cloudflare.com/hyperdrive/configuration/connect-to-private-database/) ·
[Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) ·
[better-auth Google](https://www.better-auth.com/docs/authentication/google)
