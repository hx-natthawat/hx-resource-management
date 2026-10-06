"use client";

import { useState } from "react";
import { occupiesCapacity } from "@/lib/domain/booking";
import { CURRENT_WEEK, WEEKS, weekLoad } from "@/lib/domain/capacity";
import type { Person } from "@/lib/domain/types";
import { projectOf, useStore } from "@/lib/state/store";
import { heatClass, STATUS_PILL } from "@/lib/ui/heat";

type Filter = "all" | "over" | "key" | "free";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "ทุกคน" },
  { id: "over", label: "เกิน 100%" },
  { id: "key", label: "Key Resource" },
  { id: "free", label: "ว่าง" },
];

export default function CapacityPage() {
  const { state } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);

  const rows = state.people.map((p) => ({ p, loads: WEEKS.map((w) => weekLoad(p, state.bookings, w)) }));
  const visible = rows.filter(({ p, loads }) =>
    filter === "over" ? loads.some((l) => l.percent > 100) : filter === "key" ? p.isKeyResource : filter === "free" ? loads[0].percent < 50 : true,
  );

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="h1">Capacity</h1>
        <p className="text-[13px] text-hx-muted">W{WEEKS[0]} ถึง W{WEEKS[WEEKS.length - 1]} · สัปดาห์นี้คือ W{CURRENT_WEEK} · กรอบสีทองคือมี Soft booking</p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="ตัวกรอง">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className={`min-h-[40px] shrink-0 rounded-full border px-3.5 text-[13px] font-semibold ${filter === f.id ? "border-hx-blue bg-hx-blue text-white" : "border-[rgba(52,85,137,0.2)] bg-white text-hx-blue"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <Legend />

      <ul className="flex flex-col gap-2.5 lg:hidden">
        {visible.map(({ p, loads }) => {
          const over = loads.some((l) => l.percent > 100);
          return (
            <li key={p.id} className={`rounded-[14px] bg-white ${over ? "border-[1.5px] border-[rgba(180,35,35,0.45)]" : "border border-[rgba(52,85,137,0.08)]"}`}>
              <button type="button" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)} className="flex w-full flex-col gap-2 px-3.5 py-3 text-left">
                <span className="flex items-center justify-between gap-2">
                  <span><span className="font-semibold">{p.name}</span> <span className="text-xs text-hx-muted">{p.role}{p.company !== "HarmonyX" ? ` · ${p.company}` : ""}</span></span>
                  <span className={`text-sm font-extrabold ${loads[0].percent > 100 ? "text-hx-over" : "text-hx-blue"}`}>{loads[0].percent}%</span>
                </span>
                <span className="grid grid-cols-8 gap-[3px]">
                  {loads.map((l) => (
                    <span key={l.week} title={`W${l.week} ${l.percent}%`} className={`h-[22px] rounded-[5px] ${heatClass(l.percent)} ${l.hasSoft ? "ring-2 ring-inset ring-hx-gold" : ""}`} />
                  ))}
                </span>
              </button>
              {open === p.id && <Breakdown person={p} />}
            </li>
          );
        })}
      </ul>

      <div className="card hidden overflow-x-auto p-4 lg:block">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-56 px-2 text-left text-xs font-semibold text-hx-muted">บุคลากร</th>
              {WEEKS.map((w) => <th key={w} className={`text-xs ${w === CURRENT_WEEK ? "font-extrabold text-hx-blue" : "font-semibold text-hx-muted"}`}>W{w}</th>)}
            </tr>
          </thead>
          <tbody>
            {visible.map(({ p, loads }) => (
              <tr key={p.id}>
                <td className="px-2 py-1">
                  <button type="button" className="text-left" onClick={() => setOpen(open === p.id ? null : p.id)}>
                    <span className="block font-semibold">{p.name}</span>
                    <span className="flex items-center gap-1.5 text-xs text-hx-muted">{p.role}{p.isKeyResource && <span className="pill bg-hx-warn-bg px-2 py-0 text-hx-gold-text">Key</span>}</span>
                  </button>
                </td>
                {loads.map((l) => (
                  <td key={l.week} className={`h-11 rounded-lg text-center text-[13px] font-bold ${heatClass(l.percent)} ${l.hasSoft ? "ring-2 ring-inset ring-hx-gold" : ""}`}>{l.percent}%</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {open && <div className="mt-4 rounded-xl bg-hx-tint"><Breakdown person={state.people.find((p) => p.id === open)!} /></div>}
      </div>
    </div>
  );
}

function Breakdown({ person }: { person: Person }) {
  const { state } = useStore();
  const mine = state.bookings.filter((b) => b.personId === person.id && occupiesCapacity(b));
  return (
    <ul className="flex flex-col gap-2 px-3.5 pb-3.5">
      {mine.map((b) => (
        <li key={b.id} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 ${b.status === "Proposed" ? "border-2 border-dashed border-hx-gold" : "bg-hx-tint"}`}>
          <span>
            <span className="block font-semibold">{projectOf(state, b.projectId)?.name}</span>
            <span className="text-xs text-hx-muted">Rank {projectOf(state, b.projectId)?.rank} · W{b.startWeek} ถึง W{b.endWeek}</span>
          </span>
          <span className="text-right">
            <span className="block font-bold">{b.hoursPerWeek} ชม.</span>
            <span className={`pill ${STATUS_PILL[b.status]}`}>{b.status === "Proposed" ? "Proposed (Soft)" : b.status}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Legend() {
  const items = [
    ["bg-hx-tint-2 border border-hx-sky", "ต่ำกว่า 50%"],
    ["bg-hx-sky", "50 ถึง 89%"],
    ["bg-hx-blue", "90 ถึง 100%"],
    ["bg-hx-over", "เกิน 100%"],
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-hx-muted">
      {items.map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${c}`} />{l}</span>)}
    </div>
  );
}
