"use client";

import Link from "next/link";
import { useState } from "react";
import { loadAfter, rankCandidates, weekLoad } from "@/lib/domain/capacity";
import { projectOf, useStore, YEAR } from "@/lib/state/store";
import { STATUS_PILL } from "@/lib/ui/heat";
import { formatWeekRange } from "@/lib/voice/extract";

export default function ApprovePage() {
  const { state, dispatch } = useStore();
  const queue = state.bookings.filter((b) => b.status === "Requested");
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="h1">ไม่มีคำขอค้างอนุมัติ</h1>
        <p className="text-hx-muted">คำขอใหม่จากเสียงหรือฟอร์มจะมาอยู่ที่นี่</p>
        <Link className="btn-ghost" href="/capacity">ดู Capacity</Link>
      </div>
    );
  }

  const i = Math.min(index, queue.length - 1);
  const b = queue[i];
  const project = projectOf(state, b.projectId);
  const candidates = rankCandidates(b, state.people, state.bookings);
  const chosen = candidates.find((c) => c.person.id === picked) ?? candidates[0];
  const before = chosen ? Math.max(...Array.from({ length: b.endWeek - b.startWeek + 1 }, (_, k) => weekLoad(chosen.person, state.bookings, b.startWeek + k).percent)) : 0;
  const after = chosen ? loadAfter(chosen.person, state.bookings.filter((x) => x.id !== b.id), b) : 0;

  const next = () => { setPicked(null); setShowAll(false); setIndex((x) => (x + 1) % queue.length); };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="h1">อนุมัติ Booking</h1>
          <p className="text-[13px] text-hx-muted">มีเพียง RM ที่ยืนยัน Hard booking ได้</p>
        </div>
        <span className="pill bg-hx-tint-2 text-hx-blue">{i + 1} จาก {queue.length}</span>
      </header>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${queue.length}, minmax(0, 1fr))` }} aria-hidden="true">
        {queue.map((q, k) => <span key={q.id} className={`h-1 rounded-full ${k === i ? "bg-hx-blue" : "bg-hx-line"}`} />)}
      </div>

      <article className="card flex flex-col gap-4 p-5">
        <div className="flex justify-between gap-2">
          <span className={`pill ${STATUS_PILL[b.status]}`}>{b.status}</span>
          <span className="pill bg-hx-blue text-white">Rank {project?.rank}</span>
        </div>
        <p className="text-[17px] font-semibold leading-relaxed text-hx-blue">
          {project?.name} ขอ {b.role} ระดับ {b.level}{b.skills.length ? ` สาย ${b.skills.join(" และ ")}` : ""} {b.hoursPerWeek} ชม. ต่อสัปดาห์ {formatWeekRange(YEAR, b.startWeek, b.endWeek)}
        </p>
        <p className="text-xs text-hx-muted">ขอโดย {b.requestedBy}{b.source === "voice" ? " ผ่านเสียง" : ""}</p>

        {chosen ? (
          <div className="flex flex-col gap-2.5 rounded-2xl bg-hx-tint-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-hx-gold-text">{picked ? "คนที่เลือก" : "ระบบแนะนำ"}</span>
              <span className={`pill ${chosen.fits ? "bg-hx-ok-bg text-hx-ok" : "bg-hx-over-bg text-hx-over"}`}>{chosen.fits ? "ไม่เกิน capacity" : chosen.overWip ? "เกินเพดานจำนวนโครงการ" : "เกิน capacity"}</span>
            </div>
            <div className="font-bold">{chosen.person.name} · {chosen.person.level} · {chosen.person.skills.join(", ")}</div>
            <div className="flex justify-between text-xs text-hx-muted"><span>สูงสุดตอนนี้ {before}%</span><span>หลังจอง {after}%</span></div>
            <div className="flex h-2 overflow-hidden rounded-full bg-hx-line">
              <span className="bg-hx-blue" style={{ width: `${Math.min(before, 100)}%` }} />
              <span className={after > 100 ? "bg-hx-over" : "bg-hx-gold"} style={{ width: `${Math.max(0, Math.min(after, 100) - Math.min(before, 100))}%` }} />
            </div>
          </div>
        ) : (
          <p className="text-hx-over">ไม่มีใครตรง role หรือ skill นี้</p>
        )}

        <button type="button" onClick={() => setShowAll((s) => !s)} className="flex min-h-[44px] items-center justify-between text-sm font-semibold text-hx-blue">
          {showAll ? "ซ่อนรายชื่อ" : `ดูคนอื่นที่เหมาะ ${Math.max(0, candidates.length - 1)} คน`}
        </button>
        {showAll && (
          <ul className="flex flex-col gap-2">
            {candidates.map((c) => (
              <li key={c.person.id}>
                <button type="button" onClick={() => setPicked(c.person.id)} className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left ${chosen?.person.id === c.person.id ? "border-hx-blue bg-hx-tint-2" : "border-[rgba(52,85,137,0.12)] bg-white"}`}>
                  <span className="flex-1">
                    <span className="block font-semibold">{c.person.name}{c.person.isKeyResource ? " · Key" : ""}</span>
                    <span className="text-xs text-hx-muted">skill ตรง {Math.round(c.skillMatch * 100)}% · หลังจอง {c.peakAfter}%</span>
                  </span>
                  <span className={`pill ${c.fits ? "bg-hx-ok-bg text-hx-ok" : "bg-hx-over-bg text-hx-over"}`}>{c.fits ? "ว่างพอ" : "ไม่ว่าง"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {chosen && !chosen.fits && (
          <p className="rounded-xl border-[1.5px] border-hx-over p-3 text-sm">
            ยืนยันไม่ได้เพราะจะเกิน capacity เลือกคนอื่น หรือ <Link href="/conflicts" className="font-semibold">ส่งเข้า Resource Council</Link>
          </p>
        )}
      </article>

      <div className="fixed inset-x-0 bottom-[76px] z-10 grid grid-cols-[auto_1fr_1fr] gap-2.5 bg-hx-tint/95 px-4 py-3 backdrop-blur lg:static lg:bg-transparent lg:p-0">
        <button type="button" className="btn-ghost" onClick={() => dispatch({ type: "rejectBooking", bookingId: b.id })}>ปฏิเสธ</button>
        <button type="button" className="btn-ghost" onClick={next}>ข้ามไปก่อน</button>
        <button type="button" className="btn" disabled={!chosen?.fits} onClick={() => { dispatch({ type: "approveBooking", bookingId: b.id, personId: chosen!.person.id }); setPicked(null); setShowAll(false); }}>
          อนุมัติ (Hard)
        </button>
      </div>
    </div>
  );
}
