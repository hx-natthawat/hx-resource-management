import { redirect } from "next/navigation";
import { can } from "@/modules/people";
import { loadSnapshot } from "@/server/data";
import { withPage } from "@/server/page";
import { openDrafts } from "@/server/voice/drafts";
import { VoiceChat } from "./VoiceChat";

export const dynamic = "force-dynamic";

export default async function VoicePage() {
  const data = await withPage(async ({ db, user }) => {
    if (!can(user.role, "draft.create")) return null;
    const s = await loadSnapshot(db, user.tenantId);
    return {
      projects: s.projects.filter((p) => p.status !== "Closed").map((p) => ({ id: p.id, name: p.name, rank: p.rank })),
      openCount: (await openDrafts(db, user)).length,
    };
  });
  if (!data) redirect("/");
  return <VoiceChat projects={data.projects} openCount={data.openCount} examples={data.projects.slice(0, 2).map((p, i) => (i === 0 ? `ขอ architect สายระบบ integration ให้ ${p.name} สองวันต่อสัปดาห์ ปลายตุลาถึงกลางพฤศจิกา` : `ขอ QA ระดับมิด ให้ ${p.name} เต็มเวลา เดือนหน้า`))} />;
}
