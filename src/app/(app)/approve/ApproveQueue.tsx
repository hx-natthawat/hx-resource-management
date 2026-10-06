"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/AppShell";
import { STATUS_PILL } from "@/components/heat";
import { IconBack, IconChevron } from "@/components/icons";

export interface QueueCandidate {
  personId: string;
  name: string;
  level: string;
  skills: string[];
  isKeyResource: boolean;
  skillMatch: number;
  peakAfter: number;
  peakAfterHard: number;
  fits: boolean;
  overWip: boolean;
}

export interface QueueItem {
  id: string;
  status: "Requested" | "Proposed" | string;
  role: string;
  level: string;
  skills: string[];
  hoursPerWeek: number;
  period: string;
  projectName: string;
  projectRank: number;
  requestedBy: string;
  source: string;
  note?: string;
  proposedPersonId: string | null;
  candidates: QueueCandidate[];
}

export function ApproveQueue({ items, canAct }: { items: QueueItem[]; canAct: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="h1">ไม่มีคำขอค้างอนุมัติ</h1>
        <p className="text-hx-muted">คำขอใหม่จากเสียงหรือฟอร์มจะมาอยู่ที่นี่</p>
        <Link className="btn-ghost" href="/capacity">ดู Capacity</Link>
      </div>
    );
  }

  const i = Math.min(index, items.length - 1);
  const b = items[i];
  const chosen = b.candidates.find((c) => c.personId === (picked ?? b.proposedPersonId)) ?? b.candidates[0];
  const canHard = !!chosen && chosen.peakAfterHard <= 100;
  const go = (d: number) => {
    setPicked(null);
    setShowAll(false);
    setIndex((x) => (x + d + items.length) % items.length);
  };

  const act = async (action: "propose" | "confirm" | "reject") => {
    setBusy(true);
    const res = await fetch(`/api/bookings/${b.id}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: action === "reject" ? undefined : JSON.stringify({ personId: chosen!.personId }),
    });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      toast(action === "confirm" ? `ยืนยัน ${chosen!.name} แล้ว (Hard booking)` : action === "propose" ? `เสนอชื่อ ${chosen!.name} แล้ว (Soft)` : "ปฏิเสธคำขอแล้ว");
      setPicked(null);
      setShowAll(false);
      router.refresh();
    } else if (body.error === "over_capacity") {
      toast(`${chosen!.name} จะเกิน capacity (${body.peakPercent}%) ยืนยันไม่ได้`);
    } else toast("ทำรายการไม่สำเร็จ");
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="h1">อนุมัติ Booking</h1>
          <p className="text-[13px] text-hx-muted">{canAct ? "มีเพียง RM ที่ยืนยัน Hard booking ได้" : "ดูสถานะคำขอ การอนุมัติทำโดย Resource Manager"}</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="รายการก่อนหน้า" onClick={() => go(-1)} className="flex h-11 w-11 items-center justify-center rounded-xl text-hx-blue hover:bg-hx-tint-2"><IconBack size={18} /></button>
          <span className="pill bg-hx-tint-2 text-hx-blue">{i + 1} จาก {items.length}</span>
          <button type="button" aria-label="รายการถัดไป" onClick={() => go(1)} className="flex h-11 w-11 items-center justify-center rounded-xl text-hx-blue hover:bg-hx-tint-2"><IconChevron size={18} /></button>
        </div>
      </header>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 12)}, minmax(0, 1fr))` }} aria-hidden="true">
        {items.slice(0, 12).map((q, k) => <span key={q.id} className={`h-1 rounded-full ${k === i ? "bg-hx-blue" : "bg-hx-line"}`} />)}
      </div>

      <article className="card flex flex-col gap-4 p-5">
        <div className="flex justify-between gap-2">
          <span className={`pill ${STATUS_PILL[b.status]}`}>{b.status === "Proposed" ? "Proposed (Soft)" : b.status}</span>
          <span className="pill bg-hx-blue text-white">Rank {b.projectRank}</span>
        </div>
        <p className="text-[17px] font-semibold leading-relaxed text-hx-blue">
          {b.projectName} ขอ {b.role} ระดับ {b.level}{b.skills.length ? ` สาย ${b.skills.join(" และ ")}` : ""} {b.hoursPerWeek} ชม. ต่อสัปดาห์ {b.period}
        </p>
        <p className="text-xs text-hx-muted">ขอโดย {b.requestedBy}{b.source === "voice" ? " ผ่านเสียง" : ""}{b.note ? ` · ${b.note}` : ""}</p>

        {chosen ? (
          <div className="flex flex-col gap-2.5 rounded-2xl bg-hx-tint-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-hx-gold-text">{picked ? "คนที่เลือก" : b.proposedPersonId ? "เสนอชื่อไว้แล้ว" : "ระบบแนะนำ"}</span>
              <span className={`pill ${chosen.fits ? "bg-hx-ok-bg text-hx-ok" : canHard ? "bg-hx-warn-bg text-hx-gold-text" : "bg-hx-over-bg text-hx-over"}`}>
                {chosen.fits ? "ไม่เกิน capacity" : canHard ? "ชนกับงานที่เสนอไว้" : chosen.overWip ? "เกินเพดานจำนวนโครงการ" : "เกิน capacity"}
              </span>
            </div>
            <div className="font-bold">{chosen.name} · {chosen.level} · {chosen.skills.join(", ")}</div>
            <div className="flex justify-between text-xs text-hx-muted"><span>รวมงานที่เสนอไว้ {chosen.peakAfter}%</span><span>เฉพาะ Hard {chosen.peakAfterHard}%</span></div>
            <div className="flex h-2 overflow-hidden rounded-full bg-hx-line">
              <span className={chosen.peakAfter > 100 ? "bg-hx-over" : "bg-hx-blue"} style={{ width: `${Math.min(chosen.peakAfter, 100)}%` }} />
            </div>
          </div>
        ) : (
          <p className="text-hx-over">ไม่มีใครตรง role หรือ skill นี้</p>
        )}

        {b.candidates.length > 1 && (
          <button type="button" onClick={() => setShowAll((s) => !s)} className="flex min-h-[44px] items-center justify-between text-sm font-semibold text-hx-blue">
            {showAll ? "ซ่อนรายชื่อ" : `ดูคนอื่นที่เหมาะ ${b.candidates.length - 1} คน`}
          </button>
        )}
        {showAll && (
          <ul className="flex flex-col gap-2">
            {b.candidates.map((c) => (
              <li key={c.personId}>
                <button type="button" onClick={() => setPicked(c.personId)} className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left ${chosen?.personId === c.personId ? "border-hx-blue bg-hx-tint-2" : "border-[rgba(52,85,137,0.12)] bg-white"}`}>
                  <span className="flex-1">
                    <span className="block font-semibold">{c.name}{c.isKeyResource ? " · Key" : ""}</span>
                    <span className="text-xs text-hx-muted">skill ตรง {c.skillMatch}% · หลังจอง {c.peakAfter}%</span>
                  </span>
                  <span className={`pill ${c.fits ? "bg-hx-ok-bg text-hx-ok" : "bg-hx-over-bg text-hx-over"}`}>{c.fits ? "ว่างพอ" : "ไม่ว่าง"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {chosen && !canHard && (
          <p className="rounded-xl border-[1.5px] border-hx-over p-3 text-sm">
            ยืนยันไม่ได้เพราะจะเกิน capacity เลือกคนอื่น หรือเสนอชื่อไว้ก่อนแล้ว <Link href="/conflicts" className="font-semibold">ส่งให้ Resource Council ตัดสินตาม Rank</Link>
          </p>
        )}
      </article>

      {canAct && (
        <div className="fixed inset-x-0 bottom-[76px] z-10 grid grid-cols-[auto_1fr_1fr] gap-2.5 bg-hx-tint/95 px-4 py-3 backdrop-blur lg:static lg:bg-transparent lg:p-0">
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => act("reject")}>ปฏิเสธ</button>
          <button type="button" className="btn-ghost" disabled={busy || !chosen} onClick={() => act("propose")}>เสนอ (Soft)</button>
          <button type="button" className="btn" disabled={busy || !canHard} onClick={() => act("confirm")}>อนุมัติ (Hard)</button>
        </div>
      )}
    </div>
  );
}
