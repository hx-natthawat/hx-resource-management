import { eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { z } from "zod";
import { can, type Action } from "@/modules/people";
import { DEV_COOKIE, type SessionUser } from "../auth/session";
import { confirmBooking } from "../booking/confirm";
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

  return app;
}
