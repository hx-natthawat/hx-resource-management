"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useToast } from "@/components/AppShell";
import { IconDown, IconUp } from "@/components/icons";
import { deviationsFromWsjf, wsjf, wsjfOrder, type Project } from "@/modules/portfolio";

const STATUS: Record<string, string> = {
  Active: "bg-hx-ok-bg text-hx-ok",
  Pipeline: "bg-hx-warn-bg text-hx-gold-text",
  "On-hold": "bg-hx-line text-hx-muted",
};

export function RankBoard({ projects, canEdit }: { projects: Project[]; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [order, setOrder] = useState(() => projects.map((p) => p.id));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const deviations = deviationsFromWsjf(projects, order);
  const dirty = order.some((id, i) => projects[i]?.id !== id);
  const needReason = deviations.length > 0;

  const move = (i: number, d: -1 | 1) =>
    setOrder((o) => {
      const n = [...o];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });

  const publish = async () => {
    setBusy(true);
    const res = await fetch("/api/portfolio/rank", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ order, reason: reason || undefined }) });
    setBusy(false);
    if (res.ok) {
      toast("ประกาศ Rank แล้ว ทุกทีมใช้ลำดับนี้ทันที");
      setReason("");
      router.refresh();
    } else {
      const e = await res.json().catch(() => ({}));
      toast(e.error === "reason_required" ? "ลำดับต่างจาก WSJF กรุณาระบุเหตุผล" : "บันทึกไม่สำเร็จ");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <button type="button" className="btn-ghost self-start" onClick={() => setOrder(wsjfOrder(projects))}>
          เรียงตาม WSJF
        </button>
      )}
      <ol className="flex flex-col gap-2">
        {order.map((id, i) => {
          const p = byId.get(id)!;
          const off = deviations.includes(id);
          return (
            <li key={id} className={`flex items-center gap-3 rounded-[14px] border border-[rgba(52,85,137,0.08)] py-2 pl-3 pr-2 ${off ? "bg-hx-warn-row" : "bg-white"}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-extrabold ${i < 3 ? "bg-hx-blue text-white" : "bg-hx-tint-2 text-hx-blue"}`}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-hx-muted">
                  <span>WSJF {wsjf(p.wsjf).toFixed(2)}</span>
                  <span className={`pill ${STATUS[p.status] ?? STATUS["On-hold"]}`}>{p.status}{p.winProbability ? ` ${Math.round(p.winProbability * 100)}%` : ""}</span>
                  {p.rankNote && <span>{p.rankNote}</span>}
                </div>
              </div>
              <span className="hidden gap-4 text-center text-xs text-hx-muted md:flex">
                <span>Value<br /><b className="text-hx-ink">{p.wsjf.value}</b></span>
                <span>Time<br /><b className="text-hx-ink">{p.wsjf.timeCriticality}</b></span>
                <span>Risk<br /><b className="text-hx-ink">{p.wsjf.riskReduction}</b></span>
                <span>Size<br /><b className="text-hx-ink">{p.wsjf.size}</b></span>
              </span>
              {canEdit && (
                <span className="flex flex-col gap-0.5">
                  <button type="button" aria-label={`เลื่อน ${p.name} ขึ้น`} disabled={i === 0} onClick={() => move(i, -1)} className="flex h-[26px] w-11 items-center justify-center rounded-lg bg-hx-tint-2 text-hx-blue disabled:opacity-30"><IconUp size={16} /></button>
                  <button type="button" aria-label={`เลื่อน ${p.name} ลง`} disabled={i === order.length - 1} onClick={() => move(i, 1)} className="flex h-[26px] w-11 items-center justify-center rounded-lg bg-hx-tint-2 text-hx-blue disabled:opacity-30"><IconDown size={16} /></button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-hx-muted">WSJF = (Value + Time criticality + Risk reduction) ÷ Size · คะแนน 1, 2, 3, 5, 8, 13, 20 · แถวสีทองคือจัดต่างจาก WSJF</p>

      {canEdit && dirty && needReason && (
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-hx-blue">
          เหตุผลที่จัดต่างจาก WSJF
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="input py-3 font-normal" placeholder="เช่น สัญญามีค่าปรับ" />
        </label>
      )}

      {canEdit && (
        <div className="fixed inset-x-0 bottom-[76px] z-10 bg-hx-tint/95 px-4 py-3 backdrop-blur lg:static lg:bg-transparent lg:p-0">
          <button type="button" className="btn w-full lg:w-auto" disabled={busy || !dirty || (needReason && reason.trim().length < 5)} onClick={publish}>
            {dirty ? "ประกาศ Rank รอบนี้" : "ลำดับนี้ประกาศใช้อยู่"}
          </button>
        </div>
      )}
      {!canEdit && <p className="text-sm text-hx-muted">เฉพาะผู้บริหารที่จัดและประกาศ Rank ได้</p>}
    </div>
  );
}
