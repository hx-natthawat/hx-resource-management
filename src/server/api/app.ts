import { Hono } from "hono";
import { z } from "zod";
import { confirmBooking } from "../booking/confirm";
import { withDb } from "../db/client";

export interface RequestContext {
  tenantId: string;
  actor: string;
}

export interface AppDeps {
  databaseUrl: () => string | undefined;
  /** Resolves who is calling. Replaced by better-auth with Google Workspace in the SSO feature (ADR-005). */
  context: (req: Request) => RequestContext | null;
}

const confirmBody = z.object({ personId: z.string().uuid() });
const idParam = z.string().uuid();

export function createApp(deps: AppDeps) {
  const app = new Hono().basePath("/api");

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/bookings/:id/confirm", async (c) => {
    const ctx = deps.context(c.req.raw);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const id = idParam.safeParse(c.req.param("id"));
    const body = confirmBody.safeParse(await c.req.json().catch(() => null));
    if (!id.success || !body.success) return c.json({ error: "invalid_request" }, 400);
    const url = deps.databaseUrl();
    if (!url) return c.json({ error: "database_not_configured" }, 503);

    const result = await withDb(url, (db) => confirmBooking(db, { tenantId: ctx.tenantId, bookingId: id.data, personId: body.data.personId, actor: ctx.actor }));
    if (result.ok) return c.json({ booking: result.booking, alreadyConfirmed: result.alreadyConfirmed });
    const status = result.code === "not_found" ? 404 : 409;
    return c.json({ error: result.code, message: result.message, peakPercent: result.peakPercent }, status);
  });

  return app;
}
