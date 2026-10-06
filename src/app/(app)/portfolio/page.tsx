import { and, desc, eq } from "drizzle-orm";
import { can } from "@/modules/people";
import { decisions } from "@/server/db/schema";
import { loadSnapshot } from "@/server/data";
import { withPage } from "@/server/page";
import { RankBoard } from "./RankBoard";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const { projects, log, canEdit } = await withPage(async ({ db, user }) => {
    const s = await loadSnapshot(db, user.tenantId);
    const log = await db
      .select()
      .from(decisions)
      .where(and(eq(decisions.tenantId, user.tenantId), eq(decisions.kind, "rank")))
      .orderBy(desc(decisions.decidedAt))
      .limit(5);
    return { projects: s.projects.filter((p) => p.status !== "Closed"), log, canEdit: can(user.role, "rank.edit") };
  });

  return (
    <div className="flex flex-col gap-5">
      <header>
        <span className="eyebrow">Portfolio Rank · ADR-003</span>
        <h1 className="h1">ลำดับเดียวที่ทุกทีมใช้ตัดสินเมื่อแย่งคน</h1>
        <p className="text-[13px] text-hx-muted">ห้ามอันดับซ้ำ WSJF เป็นข้อมูลประกอบ การจัดต่างจาก WSJF ต้องระบุเหตุผล</p>
      </header>
      <RankBoard projects={projects} canEdit={canEdit} />
      <section className="card flex flex-col gap-2 p-5">
        <h2 className="font-bold text-hx-blue">Decision log ของ Rank</h2>
        {log.length === 0 && <p className="text-sm text-hx-muted">ยังไม่มีการประกาศ Rank</p>}
        <ul className="flex flex-col divide-y divide-[rgba(52,85,137,0.08)]">
          {log.map((d) => (
            <li key={d.id} className="py-2.5 text-sm">
              <div className="font-semibold">{d.summary}</div>
              <div className="text-xs text-hx-muted">
                {d.decidedBy} · {d.decidedAt.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })} · {d.followedRecommendation ? "ตาม WSJF" : `ต่างจาก WSJF · ${d.reason}`}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
