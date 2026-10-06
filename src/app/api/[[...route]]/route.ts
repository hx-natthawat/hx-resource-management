import { handle } from "hono/vercel";
import { createApp } from "@/server/api/app";

const DEV_TENANT_HEADER = "x-dev-tenant-id";

const app = createApp({
  databaseUrl: () => process.env.DATABASE_URL,
  context: (req) => {
    if (process.env.NODE_ENV === "production") return null;
    const tenantId = req.headers.get(DEV_TENANT_HEADER) ?? process.env.DEV_TENANT_ID;
    return tenantId ? { tenantId, actor: "dev" } : null;
  },
});

export const GET = handle(app);
export const POST = handle(app);
