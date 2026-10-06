"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/AppShell";

type Kind = "shift" | "substitute" | "reduce";

export interface ConflictBooking {
  id: string;
  projectName: string;
  projectRank: number;
  hoursPerWeek: number;
  soft: boolean;
  period: string;
  shiftWeeks: number;
  reducedHours: number;
  shiftOk: boolean;
  reduceOk: boolean;
  substitute: { personId: string; name: string; skillMatch: number; peakAfter: number } | null;
}

export interface ConflictView {
  personId: string;
  name: string;
  role: string;
  isKeyResource: boolean;
  wipLimit: number;
  peakPercent: number;
  weeks: string;
  recommendedBookingId: string | null;
  bookings: ConflictBooking[];
}

export interface LogEntry {
  id: string;
  kind: string;
  summary: string;
  followed: boolean;
  reason: string;
  decidedBy: string;
  decidedAt: string;
}

const ERROR_TH: Record<string, string> = {
  reason_required: "เลือกต่างจากที่ระบบแนะนำ ต้องใส่เหตุผลอย่างน้อย 5 ตัวอักษร",
  substitute_unavailable: "คนที่เลือกไม่ว่างพอ ลองทางเลือกอื่น",
  no_conflict: "Conflict นี้ถูกตัดสินไปแล้ว หน้าจอจะโหลดใหม่",
  invalid_hours: "ชั่วโมงใหม่ต้องน้อยกว่าเดิม",
  still_conflicted: "ทางแก้นี้ยังทำให้เกิน capacity ลองทางเลือกอื่น",
};

const when = (iso: string) => new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function ConflictBoard({ conflicts, log, canDecide }: { conflicts: ConflictView[]; log: LogEntry[]; canDecide: boolean }) {
  const [sel, setSel] = useState(0);
  const c = conflicts[Math.min(sel, conflicts.length - 1)];

  return (
    <div className="flex flex-col gap-4">
      <header>
        <span className="eyebrow">Resource Council</span>
        <h1 className="h1">{conflicts.length ? `${conflicts.length} Conflict รอตัดสิน` : "ไม่มี Conflict"}</h1>
        <p className="text-[13px] text-hx-muted">
          {conflicts.length ? "ระบบเสนอทางแก้ตาม Rank ไว้ก่อน ถ้าเลือกต่างจากที่แนะนำต้องให้เหตุผล" : "ไม่มีใครเกิน capacity ใน 8 สัปดาห์ข้างหน้า"}
        </p>
      </header>

      {c && (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-6">
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {conflicts.map((x, k) => (
              <li key={x.personId} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setSel(k)}
                  aria-current={x === c}
                  className={`flex min-h-[64px] w-full min-w-[220px] flex-col justify-center rounded-xl border-[1.5px] px-4 py-3 text-left ${x === c ? "border-hx-blue bg-hx-tint-2" : "border-transparent bg-white"}`}
                >
                  <span className="flex justify-between gap-3">
                    <span className="font-semibold">{x.name}</span>
                    <span className="font-extrabold text-hx-over">{x.peakPercent}%</span>
                  </span>
                  <span className="text-xs text-hx-muted">{x.weeks} · {x.bookings.length} booking</span>
                </button>
              </li>
            ))}
          </ul>
          <Decide key={c.personId + c.bookings.map((b) => b.id).join()} conflict={c} canDecide={canDecide} />
        </div>
      )}

      <section className="card flex flex-col gap-2 p-5">
        <h2 className="font-bold text-hx-blue">Decision log</h2>
        {log.length === 0 && <p className="text-sm text-hx-muted">ยังไม่มีการตัดสิน</p>}
        <ul className="flex flex-col divide-y divide-[rgba(52,85,137,0.08)]">
          {log.map((d) => (
            <li key={d.id} className="py-2.5 text-sm">
              <div className="font-semibold">{d.kind === "rank" ? `จัด Rank ใหม่ · ${d.summary}` : d.summary}</div>
              <div className="text-xs text-hx-muted">
                {d.decidedBy} · {when(d.decidedAt)} · {d.followed ? (d.kind === "rank" ? "ตาม WSJF" : "ตามคำแนะนำ (ADR-003)") : `Override · ${d.reason}`}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Decide({ conflict, canDecide }: { conflict: ConflictView; canDecide: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [bookingId, setBookingId] = useState(conflict.recommendedBookingId ?? conflict.bookings[0].id);
  const [kind, setKind] = useState<Kind>(() => {
    const b = conflict.bookings.find((x) => x.id === (conflict.recommendedBookingId ?? conflict.bookings[0].id))!;
    return b.shiftOk ? "shift" : b.substitute ? "substitute" : "reduce";
  });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  // One id per attempt: a double tap or a network retry is applied once.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  const target = conflict.bookings.find((b) => b.id === bookingId)!;
  const pick = (id: string) => {
    const b = conflict.bookings.find((x) => x.id === id)!;
    setBookingId(id);
    setKind(b.shiftOk ? "shift" : b.substitute ? "substitute" : "reduce");
  };
  const recommended = kind === "shift" && bookingId === conflict.recommendedBookingId;
  const chosenOk = kind === "shift" ? target.shiftOk : kind === "reduce" ? target.reduceOk : !!target.substitute;
  const needsReason = !recommended && reason.trim().length < 5;

  const options: { kind: Kind; title: string; detail: string; disabled?: boolean }[] = [
    {
      kind: "shift",
      title: `เลื่อน ${target.projectName} ออกไป ${target.shiftWeeks} สัปดาห์`,
      detail: target.shiftOk ? `สัปดาห์แรกที่ ${conflict.name} ว่างพอ${target.soft ? " · ยังเป็น Soft booking" : ""}` : `${conflict.name} ไม่ว่างพอในปีนี้ ลองทางเลือกอื่น`,
      disabled: !target.shiftOk,
    },
    {
      kind: "substitute",
      title: target.substitute ? `ให้ ${target.substitute.name} ทำแทนใน ${target.projectName}` : "ไม่มีคนแทนที่ว่างพอ",
      detail: target.substitute ? `skill ตรง ${target.substitute.skillMatch}% · หลังจอง ${target.substitute.peakAfter}%` : "ลองทางเลือกอื่น",
      disabled: !target.substitute,
    },
    {
      kind: "reduce",
      title: `ลดชั่วโมง ${target.projectName} เหลือ ${target.reducedHours} ชม.`,
      detail: target.reduceOk ? `จาก ${target.hoursPerWeek} ชม. ต่อสัปดาห์ · ระบบแจ้ง PM ของโครงการนั้น` : "ลดแล้วยังเกิน capacity ลองทางเลือกอื่น",
      disabled: !target.reduceOk,
    },
  ];

  const save = async () => {
    setBusy(true);
    const res = await fetch("/api/conflicts/decide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestId,
        personId: conflict.personId,
        bookingId,
        kind,
        substituteId: kind === "substitute" ? target.substitute?.personId : undefined,
        reason: recommended ? undefined : reason.trim(),
      }),
    });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      toast("บันทึกการตัดสินแล้ว แจ้ง PM ของโครงการที่ถูกปรับแล้ว");
      router.refresh();
      return;
    }
    setRequestId(crypto.randomUUID());
    toast(ERROR_TH[body.error] ?? "บันทึกไม่สำเร็จ");
    if (body.error === "no_conflict") router.refresh();
  };

  return (
    <section className="card flex flex-col gap-4 p-5">
      <div className="rounded-xl border-[1.5px] border-hx-over p-3.5">
        <div className="font-bold text-hx-over">{conflict.name} · {conflict.peakPercent}% · {conflict.weeks}</div>
        <div className="text-[13px] text-hx-muted">{conflict.role}{conflict.isKeyResource ? " · Key Resource" : ""} · เพดาน {conflict.wipLimit} โครงการ</div>
      </div>

      <div>
        <div className="mb-2 text-[13px] font-bold text-hx-blue">Booking ที่ชนกัน {canDecide ? "แตะเพื่อเลือกที่จะปรับ" : ""}</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {conflict.bookings.map((b) => (
            <button
              type="button"
              key={b.id}
              disabled={!canDecide}
              onClick={() => pick(b.id)}
              aria-pressed={b.id === bookingId}
              className={`flex min-h-[88px] flex-col items-start gap-1 rounded-xl bg-white p-2.5 text-left ${b.soft ? "border-2 border-dashed border-hx-gold" : "border-[1.5px] border-[rgba(52,85,137,0.12)]"} ${b.id === bookingId && canDecide ? "ring-2 ring-hx-blue" : ""}`}
            >
              <span className="flex w-full justify-between gap-1">
                <span className={`pill ${b.projectRank <= 3 ? "bg-hx-blue text-white" : "bg-hx-sky text-hx-blue-deep"}`}>Rank {b.projectRank}</span>
                {b.id === conflict.recommendedBookingId && <span className="pill bg-hx-ok-bg text-hx-ok">แนะนำ</span>}
              </span>
              <span className="text-[13px] font-semibold">{b.projectName}</span>
              <span className="text-xs text-hx-muted">{b.hoursPerWeek} ชม. · {b.soft ? "Soft" : "Hard"}</span>
            </button>
          ))}
        </div>
      </div>

      {canDecide ? (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-bold text-hx-blue">เลือกทางแก้</legend>
            {options.map((o) => (
              <label key={o.kind} className={`flex min-h-[56px] items-start gap-3 rounded-[14px] border-[1.5px] p-3.5 ${kind === o.kind ? "border-hx-blue bg-hx-tint-2" : "border-[rgba(52,85,137,0.15)] bg-white"} ${o.disabled ? "opacity-50" : "cursor-pointer"}`}>
                <input type="radio" name="opt" disabled={o.disabled} checked={kind === o.kind} onChange={() => setKind(o.kind)} className="mt-0.5 h-[22px] w-[22px] shrink-0 accent-hx-blue" />
                <span>
                  <span className="block font-semibold">{o.title}</span>
                  {o.kind === "shift" && bookingId === conflict.recommendedBookingId && <span className="pill my-1 bg-hx-ok-bg text-hx-ok">ระบบแนะนำ · Rank ต่ำสุดเลื่อน</span>}
                  <span className="block text-xs text-hx-muted">{o.detail}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {!recommended && (
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-hx-blue">
              เหตุผลที่ไม่เลือกตามคำแนะนำ
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="input py-3 font-normal" placeholder="เช่น ลูกค้าเลื่อน UAT ไม่ได้" />
            </label>
          )}
          <div className="fixed inset-x-0 bottom-[76px] z-10 bg-hx-tint/95 px-4 py-3 backdrop-blur lg:static lg:bg-transparent lg:p-0">
            <button type="button" className="btn w-full" disabled={busy || needsReason || !chosenOk} onClick={save}>
              {busy ? "กำลังบันทึก" : "บันทึกการตัดสิน"}
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-hx-muted">Resource Council หรือ Resource Manager เป็นผู้ตัดสิน คุณจะได้รับแจ้งเมื่อมีการปรับ booking ของโครงการคุณ</p>
      )}
    </section>
  );
}
