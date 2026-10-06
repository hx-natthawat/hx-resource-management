import { eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { z } from "zod";
import { can, LEVELS, ROLES, weekOfDate, type Action } from "@/modules/people";
import { DEV_COOKIE, type SessionUser } from "../auth/session";
import { createDemand, proposeBooking, rejectBooking, type CommandResult } from "../booking/commands";
import { confirmBooking } from "../booking/confirm";
import { decideConflict } from "../conflict/decide";
import { saveRank } from "../portfolio/rank";
import { approveDraft, discardDraft, editDraft, say, type DraftOwner } from "../voice/drafts";
import { today } from "../env";
import { withDb, type Db } from "../db/client";
import { users } from "../db/schema";

export interface AppDeps {
  databaseUrl: () => string | undefined;
  /** Resolves the caller from the request. */
  session: (req: Request, db: Db) => Promise<SessionUser | null>;
  devLogin: () => boolean;
}

type Env = { Variables: { db: Db; user: SessionUser | null } };
export type ApiContext = Context<Env>;

const uuid = z.string().uuid();
/** A real calendar date: 2026-02-30 and 2026-13-45 are refused rather than rolled over. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "invalid date");

const demandBody = z
  .object({
    projectId: uuid,
    role: z.enum(ROLES),
    level: z.enum(LEVELS),
    skills: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
    hoursPerWeek: z.number().int().min(1).max(40),
    startDate: isoDate,
    endDate: isoDate,
    note: z.string().max(1000).optional(),
  })
  .strict()
  .refine((d) => d.endDate >= d.startDate, "end before start")
  // One year at most; longer engagements are booked in phases so capacity math stays bounded.
  .refine((d) => Date.parse(d.endDate) - Date.parse(d.startDate) <= 366 * 86_400_000, "longer than a year");

function commandResponse<T>(c: ApiContext, r: CommandResult<T>, ok: (v: T) => object) {
  if (r.ok) return c.json(ok(r.value));
  const status = r.code === "not_found" ? 404 : r.code === "invalid_request" ? 400 : 409;
  return c.json({ error: r.code, message: r.message }, status);
}

/** 401 without a session, 403 when the role may not perform the action (ADR-005 RBAC). */
export function guard(c: ApiContext, action?: Action): SessionUser | Response {
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);
  if (action && !can(user.role, action)) return c.json({ error: "forbidden", action }, 403);
  return user;
}

export async function readJson<T extends z.ZodTypeAny>(c: ApiContext, schema: T): Promise<z.infer<T> | null> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

export function createApp(deps: AppDeps) {
  const app = new Hono<Env>().basePath("/api");

  app.get("/health", (c) => c.json({ ok: true }));

  app.use("*", async (c, next) => {
    if (c.req.path === "/api/health") return next();
    const url = deps.databaseUrl();
    if (!url) return c.json({ error: "database_not_configured" }, 503);
    await withDb(url, async (db) => {
      c.set("db", db);
      c.set("user", await deps.session(c.req.raw, db));
      await next();
    });
  });

  app.get("/me", (c) => {
    const user = guard(c);
    return user instanceof Response ? user : c.json(user);
  });

  app.post("/dev/sign-in", async (c) => {
    if (!deps.devLogin()) return c.json({ error: "not_found" }, 404);
    const body = await readJson(c, z.object({ userId: uuid }));
    if (!body) return c.json({ error: "invalid_request" }, 400);
    const [u] = await c.get("db").select().from(users).where(eq(users.id, body.userId));
    if (!u) return c.json({ error: "not_found" }, 404);
    c.header("Set-Cookie", `${DEV_COOKIE}=${u.id}; Path=/; HttpOnly; SameSite=Lax`);
    return c.json({ ok: true, role: u.role });
  });

  app.post("/dev/sign-out", (c) => {
    c.header("Set-Cookie", `${DEV_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    return c.json({ ok: true });
  });

  app.post("/bookings/:id/confirm", async (c) => {
    const user = guard(c, "booking.confirm");
    if (user instanceof Response) return user;
    const id = uuid.safeParse(c.req.param("id"));
    const body = await readJson(c, z.object({ personId: uuid }));
    if (!id.success || !body) return c.json({ error: "invalid_request" }, 400);

    const result = await confirmBooking(c.get("db"), { tenantId: user.tenantId, bookingId: id.data, personId: body.personId, actor: user.name });
    if (result.ok) return c.json({ booking: result.booking, alreadyConfirmed: result.alreadyConfirmed });
    const status = result.code === "not_found" ? 404 : 409;
    return c.json({ error: result.code, message: result.message, peakPercent: result.peakPercent }, status);
  });

  app.post("/demands", async (c) => {
    const user = guard(c, "demand.create");
    if (user instanceof Response) return user;
    const raw = await c.req.json().catch(() => null);
    if (raw && typeof raw === "object" && "personId" in raw) {
      return c.json({ error: "named_person_not_allowed", message: "ขอคนตาม role และ skill แล้ว RM จะเสนอชื่อให้ (ADR-002)" }, 400);
    }
    const body = demandBody.safeParse(raw);
    if (!body.success) return c.json({ error: "invalid_request", issues: body.error.issues.map((i) => i.path.join(".")) }, 400);
    const d = body.data;
    const r = await createDemand(c.get("db"), {
      tenantId: user.tenantId,
      actor: user.name,
      projectId: d.projectId,
      role: d.role,
      level: d.level,
      skills: d.skills,
      hoursPerWeek: d.hoursPerWeek,
      startWeek: weekOfDate(new Date(`${d.startDate}T00:00:00Z`)),
      endWeek: weekOfDate(new Date(`${d.endDate}T00:00:00Z`)),
      note: d.note,
      source: "form",
    });
    return commandResponse(c, r, (booking) => ({ booking }));
  });

  app.post("/bookings/:id/propose", async (c) => {
    const user = guard(c, "booking.confirm");
    if (user instanceof Response) return user;
    const id = uuid.safeParse(c.req.param("id"));
    const body = await readJson(c, z.object({ personId: uuid }));
    if (!id.success || !body) return c.json({ error: "invalid_request" }, 400);
    return commandResponse(c, await proposeBooking(c.get("db"), user.tenantId, id.data, body.personId, user.name), (booking) => ({ booking }));
  });

  app.post("/bookings/:id/reject", async (c) => {
    const user = guard(c, "booking.reject");
    if (user instanceof Response) return user;
    const id = uuid.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "invalid_request" }, 400);
    return commandResponse(c, await rejectBooking(c.get("db"), user.tenantId, id.data, user.name), (booking) => ({ booking }));
  });

  app.post("/portfolio/rank", async (c) => {
    const user = guard(c, "rank.edit");
    if (user instanceof Response) return user;
    const body = await readJson(c, z.object({ order: z.array(uuid).min(1), reason: z.string().max(500).optional() }));
    if (!body) return c.json({ error: "invalid_request" }, 400);
    const result = await saveRank(c.get("db"), { tenantId: user.tenantId, actor: user.name, order: body.order, reason: body.reason });
    return result.ok ? c.json(result) : c.json({ error: result.code, message: result.message, deviations: result.deviations }, 422);
  });

  const owner = (u: SessionUser): DraftOwner => ({ tenantId: u.tenantId, userId: u.userId, name: u.name });
  const draftStatus = (code: string) => (code === "not_found" ? 404 : code === "incomplete" ? 422 : 409);

  // Voice first, human approves (ADR-008): utterances fill a draft; only approval creates a booking.
  app.post("/voice/say", async (c) => {
    const user = guard(c, "draft.create");
    if (user instanceof Response) return user;
    const body = await readJson(c, z.object({ draftId: uuid.optional(), text: z.string().trim().min(1).max(2000) }).strict());
    if (!body) return c.json({ error: "invalid_request" }, 400);
    const r = await say(c.get("db"), owner(user), { ...body, today: today() });
    return r.ok ? c.json(r) : c.json({ error: r.code, message: r.message }, draftStatus(r.code));
  });

  app.patch("/drafts/:id", async (c) => {
    const user = guard(c, "draft.create");
    if (user instanceof Response) return user;
    const id = uuid.safeParse(c.req.param("id"));
    const body = await readJson(
      c,
      z
        .object({
          projectId: uuid.optional(),
          role: z.enum(ROLES).optional(),
          level: z.enum(LEVELS).optional(),
          skills: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
          hoursPerWeek: z.number().int().min(1).max(40).optional(),
          startDate: isoDate.optional(),
          endDate: isoDate.optional(),
        })
        .strict(),
    );
    if (!id.success || !body) return c.json({ error: "invalid_request" }, 400);
    const { startDate, endDate, ...rest } = body;
    const toWeek = (d?: string) => (d ? weekOfDate(new Date(`${d}T00:00:00Z`)) : undefined);
    const r = await editDraft(c.get("db"), owner(user), id.data, { ...rest, startWeek: toWeek(startDate), endWeek: toWeek(endDate) });
    return r.ok ? c.json(r) : c.json({ error: r.code, message: r.message }, draftStatus(r.code));
  });

  app.post("/drafts/:id/approve", async (c) => {
    const user = guard(c, "draft.create");
    if (user instanceof Response) return user;
    const id = uuid.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "invalid_request" }, 400);
    const r = await approveDraft(c.get("db"), owner(user), id.data);
    return r.ok ? c.json(r) : c.json({ error: r.code, message: r.message, missing: r.missing }, draftStatus(r.code));
  });

  app.post("/drafts/:id/discard", async (c) => {
    const user = guard(c, "draft.create");
    if (user instanceof Response) return user;
    const id = uuid.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "invalid_request" }, 400);
    const r = await discardDraft(c.get("db"), owner(user), id.data);
    return r.ok ? c.json(r) : c.json({ error: "not_found" }, 404);
  });

  app.post("/conflicts/decide", async (c) => {
    const user = guard(c, "conflict.decide");
    if (user instanceof Response) return user;
    const body = await readJson(
      c,
      z
        .object({
          requestId: uuid,
          personId: uuid,
          bookingId: uuid,
          kind: z.enum(["shift", "substitute", "reduce"]),
          substituteId: uuid.optional(),
          hoursPerWeek: z.number().int().min(1).max(40).optional(),
          reason: z.string().max(500).optional(),
        })
        .strict(),
    );
    if (!body) return c.json({ error: "invalid_request" }, 400);
    const result = await decideConflict(c.get("db"), { ...body, tenantId: user.tenantId, actor: user.name, actorUserId: user.userId });
    if (result.ok) return c.json({ decision: result.decision, replayed: result.replayed });
    const status = result.code === "not_found" ? 404 : result.code === "no_conflict" ? 409 : 422;
    return c.json({ error: result.code, message: result.message, peakPercent: result.peakPercent }, status);
  });

  return app;
}
