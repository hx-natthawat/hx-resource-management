import { eq } from "drizzle-orm";
import { ROLE_LABEL } from "@/modules/people";
import { withDb } from "@/server/db/client";
import { tenants, users } from "@/server/db/schema";
import { databaseUrl, devLoginEnabled } from "@/server/env";
import { DEMO_TENANT } from "@/server/seed/demo";
import { DevSignIn } from "./DevSignIn";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const url = databaseUrl();
  const demoUsers =
    url && devLoginEnabled()
      ? await withDb(url, (db) =>
          db
            .select({ id: users.id, name: users.name, role: users.role })
            .from(users)
            .innerJoin(tenants, eq(users.tenantId, tenants.id))
            .where(eq(tenants.name, DEMO_TENANT)),
        )
      : [];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-hx-gold" />
        <span className="flex flex-col leading-tight">
          <span className="text-xl font-extrabold tracking-[-0.02em] text-hx-blue">HarmonyX</span>
          <span className="text-xs text-hx-muted">Resource Management</span>
        </span>
      </div>
      <h1 className="h1">เข้าสู่ระบบ</h1>
      <p className="text-sm text-hx-muted">ใช้บัญชี Google Workspace ของบริษัท การเข้าสู่ระบบด้วย Google จะเปิดใช้ในงาน #16</p>
      {demoUsers.length > 0 && (
        <section className="card flex flex-col gap-3 p-5">
          <span className="eyebrow">ผู้ใช้ตัวอย่าง (เฉพาะเครื่องนักพัฒนา)</span>
          <DevSignIn users={demoUsers.map((u) => ({ id: u.id, name: u.name, roleLabel: ROLE_LABEL[u.role] }))} />
        </section>
      )}
    </main>
  );
}
