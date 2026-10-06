import { handle } from "hono/vercel";
import { createApp } from "@/server/api/app";
import { sessionFromCookies } from "@/server/auth/session";
import { databaseUrl, devLoginEnabled } from "@/server/env";

const app = createApp({
  databaseUrl,
  session: (req, db) => sessionFromCookies(db, req.headers.get("cookie")),
  devLogin: devLoginEnabled,
});

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
