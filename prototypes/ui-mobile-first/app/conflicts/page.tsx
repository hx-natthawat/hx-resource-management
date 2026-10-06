"use client";

import { useState } from "react";
import { findConflicts, rankCandidates, recommendResolution } from "@/lib/domain/capacity";
import type { Conflict, DecisionKind } from "@/lib/domain/types";
import { personOf, projectOf, ROLE_LABEL, useStore } from "@/lib/state/store";

export default function ConflictsPage() {
  const { state } = useStore();
  const conflicts = findConflicts(state.people, state.bookings);
  const [sel, setSel] = useState(0);
  const c = conflicts[Math.min(sel, conflicts.length - 1)];

  return (
    <div className="flex flex-col gap-4">
      <header>
        <span className="eyebrow">Resource Council</span>
        <h1 className="h1">{conflicts.length ? `${conflicts.length} Conflict รอตัดสิน` : "ไม่มี Conflict"}</h1>
        <p className="text-[13px] text-hx-muted">ระบบเสนอทางเลือกตาม Rank ไว้ก่อน ถ้าเลือกต่างจากที่แนะนำต้องให้เหตุผล</p>
      </header>

      {conflicts.length > 0 && (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-6">
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {conflicts.map((x, k) => (
              <li key={x.personId} className="shrink-0">
                <button type="button" onClick={() => setSel(k)} className={`flex w-full min-w-[220px] flex-col rounded-xl border px-4 py-3 text-left ${x === c ? "border-hx-blue bg-hx-tint-2" : "border-transparent bg-white"}`}>
                  <span className="flex justify-between gap-3"><span className="font-semibold">{personOf(state, x.personId)?.name}</span><span className="font-extrabold text-hx-over">{x.peakPercent}%</span></span>
                  <span className="text-xs text-hx-muted">W{x.weeks[0]}{x.weeks.length > 1 ? ` ถึง W${x.weeks[x.weeks.length - 1]}` : ""} · {x.bookingIds.length} booking</span>
                </button>
              </li>
            ))}
          </ul>
          {c && <Decide key={c.personId + c.bookingIds.join()} conflict={c} />}
        </div>
      )}

      <section className="card flex flex-col gap-2 p-5">
        <h2 className="font-bold text-hx-blue">Decision log</h2>
        {state.decisions.length === 0 && <p className="text-sm text-hx-muted">ยังไม่มีการตัดสินในรอบนี้</p>}
        <ul className="flex flex-col divide-y divide-[rgba(52,85,137,0.08)]">
          {state.decisions.map((d) => (
            <li key={d.id} className="py-2.5 text-sm">
              <div className="font-semibold">{d.summary}</div>
              <div className="text-xs text-hx-muted">{d.decidedBy} · {d.followedRecommendation ? "ตามคำแนะนำ (ADR-003)" : `Override · ${d.reason}`}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Decide({ conflict }: { conflict: Conflict }) {
  const { state, dispatch } = useStore();
  const person = personOf(state, conflict.personId)!;
  const rec = recommendResolution(conflict, state.bookings, state.projects);
  const target = state.bookings.find((b) => b.id === rec?.bookingId);
  const targetProject = target && projectOf(state, target.projectId);
  const sub = target ? rankCandidates({ ...target, personId: null }, state.people.filter((p) => p.id !== person.id), state.bookings).find((x) => x.fits) : undefined;
  const [kind, setKind] = useState<DecisionKind>("shift");
  const [reason, setReason] = useState("");
  const recommended = kind === "shift";

  if (!target || !rec) return null;
  const involved = state.bookings.filter((b) => conflict.bookingIds.includes(b.id));

  const options: { kind: DecisionKind; title: string; detail: string; disabled?: boolean }[] = [
    { kind: "shift", title: `เลื่อน ${targetProject?.name} ออกไป ${rec.shiftWeeks} สัปดาห์`, detail: `Rank ${targetProject?.rank} ต่ำสุด${target.status === "Proposed" ? " และยังเป็น Soft booking" : ""}` },
    { kind: "substitute", title: sub ? `ให้ ${sub.person.name} ทำแทนใน ${targetProject?.name}` : "ไม่มีคนแทนที่ว่างพอ", detail: sub ? `skill ตรง ${Math.round(sub.skillMatch * 100)}% · หลังจอง ${sub.peakAfter}%` : "ลองทางเลือกอื่น", disabled: !sub },
    { kind: "reduce", title: `ลดชั่วโมง ${targetProject?.name} ลงครึ่งหนึ่ง`, detail: `จาก ${target.hoursPerWeek} เหลือ ${Math.max(4, Math.round(target.hoursPerWeek / 2))} ชม. ต้องแจ้ง PM ของโครงการนั้น` },
  ];

  const save = () => {
    const chosen = options.find((o) => o.kind === kind)!;
    dispatch({
      type: "decide",
      bookingId: target.id,
      shiftWeeks: rec.shiftWeeks,
      substituteId: sub?.person.id,
      decision: { personId: person.id, weeks: conflict.weeks, kind, summary: `${person.name} · ${chosen.title}`, followedRecommendation: recommended, reason: recommended ? "ตามกฎ Rank สูงกว่าได้ก่อน" : reason, decidedBy: ROLE_LABEL[state.role].who },
    });
  };

  return (
    <section className="card flex flex-col gap-4 p-5">
      <div className="rounded-xl border-[1.5px] border-hx-over p-3.5">
        <div className="font-bold text-hx-over">{person.name} · {conflict.peakPercent}% · W{conflict.weeks.join(", W")}</div>
        <div className="text-[13px] text-hx-muted">{person.role}{person.isKeyResource ? " · Key Resource" : ""} · เพดาน {person.wipLimit} โครงการ</div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {involved.map((b) => {
          const p = projectOf(state, b.projectId);
          return (
            <div key={b.id} className={`flex flex-col gap-1 rounded-xl bg-white p-2.5 ${b.status === "Proposed" ? "border-2 border-dashed border-hx-gold" : "border border-[rgba(52,85,137,0.08)]"}`}>
              <span className={`pill self-start ${(p?.rank ?? 9) <= 3 ? "bg-hx-blue text-white" : "bg-hx-sky text-hx-blue-deep"}`}>Rank {p?.rank}</span>
              <span className="text-[13px] font-semibold">{p?.name}</span>
              <span className="text-xs text-hx-muted">{b.hoursPerWeek} ชม. · {b.status === "Proposed" ? "Soft" : "Hard"}</span>
            </div>
          );
        })}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-bold text-hx-blue">เลือกทางแก้</legend>
        {options.map((o) => (
          <label key={o.kind} className={`flex items-start gap-3 rounded-[14px] border-[1.5px] p-3.5 ${kind === o.kind ? "border-hx-blue bg-hx-tint-2" : "border-[rgba(52,85,137,0.15)] bg-white"} ${o.disabled ? "opacity-50" : "cursor-pointer"}`}>
            <input type="radio" name="opt" disabled={o.disabled} checked={kind === o.kind} onChange={() => setKind(o.kind)} className="mt-0.5 h-[22px] w-[22px] accent-hx-blue" />
            <span>
              <span className="block font-semibold">{o.title}</span>
              {o.kind === "shift" && <span className="pill my-1 bg-hx-ok-bg text-hx-ok">ระบบแนะนำ</span>}
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
      <button type="button" className="btn" disabled={!recommended && reason.trim().length < 5} onClick={save}>บันทึกการตัดสิน</button>
    </section>
  );
}
