"use client";

import Link from "next/link";
import { IconAlert, IconChevron, IconMic } from "@/components/icons";
import { findConflicts } from "@/lib/domain/capacity";
import { personOf, projectOf, ROLE_LABEL, useStore } from "@/lib/state/store";

export default function Home() {
  const { state } = useStore();
  const me = ROLE_LABEL[state.role];
  const conflicts = findConflicts(state.people, state.bookings);
  const requests = state.bookings.filter((b) => b.status === "Requested");
  const crm = state.bookings.filter((b) => b.projectId === "crm" && b.status !== "Rejected" && b.status !== "Released");
  const crmFilled = crm.filter((b) => b.status === "Confirmed").length;

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8">
      <div className="flex flex-col gap-5">
        <header>
          <p className="text-[13px] text-hx-muted">สวัสดีครับ</p>
          <h1 className="h1">{me.who}</h1>
        </header>

        <Link href="/voice" className="flex items-center gap-3.5 rounded-[18px] bg-hx-blue p-4 text-white no-underline shadow-[0_10px_30px_rgba(52,85,137,0.25)] lg:p-6">
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-hx-gold"><IconMic size={24} /></span>
          <span className="flex flex-col">
            <span className="font-bold lg:text-lg">พูดสั่งงานได้เลย</span>
            <span className="text-[13px] opacity-85">ขอคน เลื่อนงาน หรือถามว่าใครว่าง ระบบกรอกให้ คุณตรวจและอนุมัติอย่างเดียว</span>
          </span>
        </Link>

        <section className="flex flex-col gap-2">
          <h2 className="flex items-center justify-between text-[13px] font-bold text-hx-blue">
            รอคุณตรวจหรืออนุมัติ <span className="pill bg-hx-gold text-white">{state.drafts.length + (state.role === "PM" ? 0 : requests.length)}</span>
          </h2>
          {state.drafts.map((d) => (
            <ListLink key={d.id} href="/review" tag="Demand" tagCls="bg-hx-tint-2 text-hx-blue" title={`${d.role?.value ?? "ยังไม่ระบุตำแหน่ง"} · ${d.hoursPerWeek?.value ?? "?"} ชม.`} sub="จากเสียง · รอคุณตรวจ" />
          ))}
          {state.role !== "PM" &&
            requests.map((b) => (
              <ListLink key={b.id} href="/approve" tag="Booking" tagCls="bg-hx-warn-bg text-hx-gold-text" title={`${b.role} · ${b.hoursPerWeek} ชม.`} sub={`${projectOf(state, b.projectId)?.name} · W${b.startWeek} ถึง W${b.endWeek}`} />
            ))}
          {state.drafts.length === 0 && (state.role === "PM" || requests.length === 0) && <p className="text-sm text-hx-muted">ไม่มีรายการค้าง</p>}
        </section>
      </div>

      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-bold text-hx-blue">แจ้งเตือน</h2>
          {conflicts.length === 0 && <p className="text-sm text-hx-muted">ไม่มีใครเกิน capacity</p>}
          {conflicts.map((c) => (
            <Link key={c.personId} href="/conflicts" className="flex min-h-[64px] items-center gap-3 rounded-[14px] border-[1.5px] border-hx-over bg-white px-3.5 py-3 no-underline">
              <IconAlert className="shrink-0 text-hx-over" size={22} />
              <span className="flex-1">
                <span className="block font-semibold text-hx-over">{personOf(state, c.personId)?.name} เกิน capacity</span>
                <span className="text-xs text-hx-muted">W{c.weeks[0]}{c.weeks.length > 1 ? ` ถึง W${c.weeks[c.weeks.length - 1]}` : ""} · {c.peakPercent}%</span>
              </span>
            </Link>
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-bold text-hx-blue">โครงการของฉัน</h2>
          <div className="card flex flex-col gap-2 p-4">
            <div className="flex justify-between"><span className="font-semibold">CRM ภาครัฐ</span><span className="pill bg-hx-blue text-white">Rank {projectOf(state, "crm")?.rank}</span></div>
            <p className="text-xs text-hx-muted">ยืนยันคนแล้ว {crmFilled} จาก {crm.length} ตำแหน่ง</p>
            <div className="h-2 overflow-hidden rounded-full bg-hx-line"><div className="h-full bg-hx-blue" style={{ width: `${crm.length ? (crmFilled / crm.length) * 100 : 0}%` }} /></div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ListLink({ href, tag, tagCls, title, sub }: { href: string; tag: string; tagCls: string; title: string; sub: string }) {
  return (
    <Link href={href} className="flex min-h-[64px] items-center gap-3 rounded-[14px] border border-[rgba(52,85,137,0.08)] bg-white px-3.5 py-3 text-hx-ink no-underline hover:bg-hx-tint-2">
      <span className={`pill ${tagCls}`}>{tag}</span>
      <span className="flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="text-xs text-hx-muted">{sub}</span>
      </span>
      <IconChevron className="text-hx-muted" size={18} />
    </Link>
  );
}
