"use client";

import Link from "next/link";
import { IconDown, IconUp } from "@/components/icons";
import { wsjf } from "@/lib/domain/rank";
import { useStore } from "@/lib/state/store";

const STATUS: Record<string, string> = {
  Active: "bg-hx-ok-bg text-hx-ok",
  Pipeline: "bg-hx-warn-bg text-hx-gold-text",
  "On-hold": "bg-hx-line text-hx-muted",
  Closed: "bg-hx-line text-hx-muted",
};

export default function PortfolioPage() {
  const { state, dispatch } = useStore();
  const projects = [...state.projects].sort((a, b) => a.rank - b.rank);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Portfolio Rank</h1>
          <p className="text-[13px] text-hx-muted">{state.ranksPublishedAt ? "ประกาศแล้ว · ใช้ตัดสิน Conflict ทุกทีม" : "ร่าง · ยังไม่ประกาศ"} · ห้ามอันดับซ้ำ</p>
        </div>
        <Link href="/conflicts" className="text-sm font-semibold">ไปที่ Conflict</Link>
      </header>

      <ol className="flex flex-col gap-2">
        {projects.map((p, i) => (
          <li key={p.id} className={`flex items-center gap-3 rounded-[14px] border border-[rgba(52,85,137,0.08)] py-2 pl-3 pr-2 ${p.rankNote ? "bg-hx-warn-row" : "bg-white"}`}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-extrabold ${i < 3 ? "bg-hx-blue text-white" : "bg-hx-tint-2 text-hx-blue"}`}>{p.rank}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{p.name}</div>
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-hx-muted">
                <span>WSJF {wsjf(p.wsjf).toFixed(2)}</span>
                <span className={`pill ${STATUS[p.status]}`}>{p.status}{p.winProbability ? ` ${Math.round(p.winProbability * 100)}%` : ""}</span>
                {p.rankNote && <span>{p.rankNote}</span>}
              </div>
            </div>
            <span className="hidden gap-4 text-center text-xs text-hx-muted md:flex">
              <span>Value<br /><b className="text-hx-ink">{p.wsjf.value}</b></span>
              <span>Time<br /><b className="text-hx-ink">{p.wsjf.timeCriticality}</b></span>
              <span>Risk<br /><b className="text-hx-ink">{p.wsjf.riskReduction}</b></span>
              <span>Size<br /><b className="text-hx-ink">{p.wsjf.size}</b></span>
            </span>
            <span className="flex flex-col gap-0.5">
              <button type="button" aria-label={`เลื่อน ${p.name} ขึ้น`} disabled={i === 0} onClick={() => dispatch({ type: "moveRank", projectId: p.id, direction: -1 })} className="flex h-[26px] w-11 items-center justify-center rounded-lg bg-hx-tint-2 text-hx-blue disabled:opacity-30"><IconUp size={16} /></button>
              <button type="button" aria-label={`เลื่อน ${p.name} ลง`} disabled={i === projects.length - 1} onClick={() => dispatch({ type: "moveRank", projectId: p.id, direction: 1 })} className="flex h-[26px] w-11 items-center justify-center rounded-lg bg-hx-tint-2 text-hx-blue disabled:opacity-30"><IconDown size={16} /></button>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-hx-muted">WSJF = (Value + Time criticality + Risk reduction) ÷ Size · คะแนน 1, 2, 3, 5, 8, 13, 20</p>

      <div className="fixed inset-x-0 bottom-[76px] z-10 bg-hx-tint/95 px-4 py-3 backdrop-blur lg:static lg:bg-transparent lg:p-0">
        <button type="button" className="btn w-full lg:w-auto" disabled={!!state.ranksPublishedAt} onClick={() => dispatch({ type: "publishRanks" })}>
          {state.ranksPublishedAt ? "ประกาศแล้ว" : "ประกาศ Rank รอบนี้"}
        </button>
      </div>
    </div>
  );
}
