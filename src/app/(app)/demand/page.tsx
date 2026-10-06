import { can, LEVELS, ROLES } from "@/modules/people";
import { loadSnapshot } from "@/server/data";
import { withPage } from "@/server/page";
import { DemandForm } from "./DemandForm";

export const dynamic = "force-dynamic";

export default async function DemandPage() {
  const { projects, allowed } = await withPage(async ({ db, user }) => {
    const s = await loadSnapshot(db, user.tenantId);
    return { projects: s.projects.filter((p) => p.status !== "Closed").map((p) => ({ id: p.id, name: p.name, rank: p.rank })), allowed: can(user.role, "demand.create") };
  });
  return <DemandForm projects={projects} roles={[...ROLES]} levels={[...LEVELS]} allowed={allowed} />;
}
