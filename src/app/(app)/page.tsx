import { and, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { IconAlert, IconChevron, IconMic } from "@/components/icons";
import { findConflicts } from "@/modules/conflict";
import { ROLE_LABEL, weekLabel, weeksFrom } from "@/modules/people";
import { loadSnapshot } from "@/server/data";
import { notifications, projects as projectsTable } from "@/server/db/schema";
import { currentWeek, withPage } from "@/server/page";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await withPage(async ({ db, user }) => {
    const s = await loadSnapshot(db, user.tenantId);
    const owned = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(eq(projectsTable.tenantId, user.tenantId), eq(projectsTable.ownerUserId, user.userId)));
    const notices = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.tenantId, user.tenantId), eq(notifications.userId, user.userId), isNull(notifications.readAt)))
      .orderBy(desc(notifications.createdAt))
      .limit(5);
    return { user, s, ownedIds: new Set(owned.map((o) => o.id)), notices };
  });
  const { user, s, ownedIds, notices } = data;
  const name = (id: string) => s.people.find((p) => p.id === id)?.name ?? "";
  const projectName = (id: string) => s.projects.find((p) => p.id === id)?.name ?? "";
  const conflicts = findConflicts(s.people, s.bookings, weeksFrom(currentWeek(), 8), s.capacityOf);
  const requests = s.bookings.filter((b) => b.status === "Requested");
  const mine = s.projects.filter((p) => ownedIds.has(p.id));
  const canSpeak = user.role === "PM" || user.role === "RM" || user.role === "Admin";

  const todo =
    user.role === "RM"
      ? requests.map((b) => ({ key: b.id, href: "/approve", tag: "Booking", tagCls: "bg-hx-warn-bg text-hx-gold-text", title: `${b.role} · ${b.hoursPerWeek} ชม.`, sub: `${projectName(b.projectId)} · ${weekLabel(b.startWeek)} ถึง ${weekLabel(b.endWeek)}` }))
      : user.role === "Council"
        ? conflicts.map((c) => ({ key: c.personId, href: "/conflicts", tag: "Conflict", tagCls: "bg-hx-over-bg text-hx-over", title: `${name(c.personId)} · ${c.peakPercent}%`, sub: `${c.weeks.map(weekLabel).join(", ")}` }))
        : user.role === "PM"
          ? requests.filter((b) => ownedIds.has(b.projectId)).map((b) => ({ key: b.id, href: "/approve", tag: "รอ RM", tagCls: "bg-hx-tint-2 text-hx-blue", title: `${b.role} · ${b.hoursPerWeek} ชม.`, sub: projectName(b.projectId) }))
          : [];

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8">
      <div className="flex flex-col gap-5">
        <header className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[13px] text-hx-muted">สวัสดีครับ</p>
            <h1 className="h1">{user.name}</h1>
          </div>
          <span className="pill hidden bg-hx-tint-2 text-hx-blue lg:inline-flex">{ROLE_LABEL[user.role]}</span>
        </header>

        {canSpeak && (
          <Link href="/voice" className="flex items-center gap-3.5 rounded-[18px] bg-hx-blue p-4 text-white no-underline shadow-[0_10px_30px_rgba(52,85,137,0.25)] lg:p-6">
            <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-hx-gold"><IconMic size={24} /></span>
            <span className="flex flex-col">
              <span className="font-bold lg:text-lg">พูดสั่งงานได้เลย</span>
              <span className="text-[13px] opacity-85">ขอคน เลื่อนงาน หรือถามว่าใครว่าง ระบบกรอกให้ คุณตรวจและอนุมัติอย่างเดียว</span>
            </span>
          </Link>
        )}

        {user.role === "Executive" && (
          <Link href="/portfolio" className="card flex min-h-[64px] items-center gap-3 p-4 text-hx-ink no-underline">
            <span className="flex-1">
              <span className="block font-semibold">Portfolio Rank รอบนี้</span>
              <span className="text-xs text-hx-muted">{s.projects.length} โครงการ · ใช้ตัดสิน Conflict ทุกทีม</span>
            </span>
            <IconChevron className="text-hx-muted" size={18} />
          </Link>
        )}

        {notices.length > 0 && (
          <section className="flex flex-col gap-2" aria-label="อัปเดตถึงคุณ">
            <h2 className="text-[13px] font-bold text-hx-blue">อัปเดตถึงคุณ</h2>
            {notices.map((n) => (
              <Link key={n.id} href={n.href} className="flex min-h-[64px] items-start gap-3 rounded-[14px] border-[1.5px] border-hx-gold bg-white px-3.5 py-3 text-hx-ink no-underline">
                <IconAlert className="mt-0.5 shrink-0 text-hx-gold-text" size={18} />
                <span className="flex-1">
                  <span className="block font-semibold">{n.title}</span>
                  <span className="text-xs text-hx-muted">{n.body}</span>
                </span>
              </Link>
            ))}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="flex items-center justify-between text-[13px] font-bold text-hx-blue">
            {user.role === "PM" ? "คำขอของฉันที่รอ RM" : "รอคุณตรวจหรืออนุมัติ"} <span className="pill bg-hx-gold text-white">{todo.length}</span>
          </h2>
          {todo.length === 0 && <p className="text-sm text-hx-muted">ไม่มีรายการค้าง</p>}
          {todo.map((t) => (
            <Link key={t.key} href={t.href} className="flex min-h-[64px] items-center gap-3 rounded-[14px] border border-[rgba(52,85,137,0.08)] bg-white px-3.5 py-3 text-hx-ink no-underline hover:bg-hx-tint-2">
              <span className={`pill ${t.tagCls}`}>{t.tag}</span>
              <span className="flex-1">
                <span className="block font-semibold">{t.title}</span>
                <span className="text-xs text-hx-muted">{t.sub}</span>
              </span>
              <IconChevron className="text-hx-muted" size={18} />
            </Link>
          ))}
        </section>
      </div>

      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-bold text-hx-blue">แจ้งเตือน</h2>
          {conflicts.length === 0 && <p className="text-sm text-hx-muted">ไม่มีใครเกิน capacity ใน 8 สัปดาห์ข้างหน้า</p>}
          {conflicts.slice(0, 4).map((c) => (
            <Link key={c.personId} href="/conflicts" className="flex min-h-[64px] items-center gap-3 rounded-[14px] border-[1.5px] border-hx-over bg-white px-3.5 py-3 no-underline">
              <IconAlert className="shrink-0 text-hx-over" size={22} />
              <span className="flex-1">
                <span className="block font-semibold text-hx-over">{name(c.personId)} เกิน capacity</span>
                <span className="text-xs text-hx-muted">{c.weeks.map(weekLabel).join(", ")} · {c.peakPercent}%</span>
              </span>
            </Link>
          ))}
        </section>

        {mine.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-[13px] font-bold text-hx-blue">โครงการของฉัน</h2>
            {mine.map((p) => {
              const open = s.bookings.filter((b) => b.projectId === p.id);
              const filled = open.filter((b) => b.status === "Confirmed").length;
              return (
                <div key={p.id} className="card flex flex-col gap-2 p-4">
                  <div className="flex justify-between"><span className="font-semibold">{p.name}</span><span className="pill bg-hx-blue text-white">Rank {p.rank}</span></div>
                  <p className="text-xs text-hx-muted">ยืนยันคนแล้ว {filled} จาก {open.length} ตำแหน่ง</p>
                  <div className="h-2 overflow-hidden rounded-full bg-hx-line"><div className="h-full bg-hx-blue" style={{ width: `${open.length ? (filled / open.length) * 100 : 0}%` }} /></div>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
