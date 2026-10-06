"use client";

import Link from "next/link";
import { useState } from "react";
import { heatClass, STATUS_PILL } from "@/components/heat";
import { IconBack, IconChevron } from "@/components/icons";

export interface WeekHead {
  week: number;
  label: string;
  current: boolean;
  holidays: string[];
}

export interface HeatCell {
  week: number;
  percent: number;
  hardPercent: number;
  hasSoft: boolean;
  capacityHours: number;
  hardHours: number;
  softHours: number;
}

export interface HeatRow {
  id: string;
  name: string;
  role: string;
  company: string;
  isKeyResource: boolean;
  loads: HeatCell[];
  bookings: { id: string; projectName: string; projectRank: number; hoursPerWeek: number; status: string; period: string }[];
}

type Filter = "all" | "over" | "key" | "free";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "ทุกคน" },
  { id: "over", label: "เกิน 100%" },
  { id: "key", label: "Key Resource" },
  { id: "free", label: "ว่าง" },
];

const cellTitle = (h: WeekHead, l: HeatCell) =>
  `${h.label} · ${l.percent}% · Hard ${l.hardHours} ชม.${l.softHours ? ` + Soft ${l.softHours} ชม.` : ""} จาก ${l.capacityHours} ชม.${h.holidays.length ? ` · วันหยุด ${h.holidays.join(", ")}` : ""}`;

export function CapacityBoard({ rows, heads, prev, next, isNow, range }: { rows: HeatRow[]; heads: WeekHead[]; prev: number; next: number; isNow: boolean; range: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const visible = rows.filter(({ isKeyResource, loads }) =>
    filter === "over" ? loads.some((l) => l.percent > 100) : filter === "key" ? isKeyResource : filter === "free" ? loads[0].percent < 50 : true,
  );
  const holidayWeeks = heads.filter((h) => h.holidays.length);
  const openRow = rows.find((r) => r.id === open);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="h1">Capacity</h1>
          <p className="text-[13px] text-hx-muted">
            {range} · กรอบสีทองคือมี Soft booking
          </p>
        </div>
        <nav className="flex items-center gap-1" aria-label="เลื่อนช่วงสัปดาห์">
          <Link href={`/capacity?from=${prev}`} aria-label="8 สัปดาห์ก่อนหน้า" className="flex h-11 w-11 items-center justify-center rounded-xl text-hx-blue hover:bg-hx-tint-2"><IconBack size={18} /></Link>
          {!isNow && <Link href="/capacity" className="pill bg-hx-tint-2 text-hx-blue no-underline">สัปดาห์นี้</Link>}
          <Link href={`/capacity?from=${next}`} aria-label="8 สัปดาห์ถัดไป" className="flex h-11 w-11 items-center justify-center rounded-xl text-hx-blue hover:bg-hx-tint-2"><IconChevron size={18} /></Link>
        </nav>
      </header>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0" role="group" aria-label="ตัวกรอง">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className={`min-h-[44px] shrink-0 rounded-full border px-4 text-[13px] font-semibold ${filter === f.id ? "border-hx-blue bg-hx-blue text-white" : "border-[rgba(52,85,137,0.2)] bg-white text-hx-blue"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <Legend />

      {holidayWeeks.length > 0 && (
        <p className="rounded-xl bg-hx-warn-bg px-3.5 py-2.5 text-xs text-hx-gold-text">
          วันหยุดลด capacity: {holidayWeeks.map((h) => `${h.label} ${h.holidays.join(", ")}`).join(" · ")}
        </p>
      )}

      {visible.length === 0 && <p className="text-sm text-hx-muted">ไม่มีใครตรงตัวกรองนี้</p>}

      <ul className="flex flex-col gap-2.5 lg:hidden">
        <li aria-hidden="true" className="grid grid-cols-8 gap-[3px] px-3.5 text-center text-[10px] font-semibold text-hx-muted">
          {heads.map((h) => (
            <span key={h.week} className={h.current ? "font-extrabold text-hx-blue" : ""}>{h.label}{h.holidays.length ? "•" : ""}</span>
          ))}
        </li>
        {visible.map((r) => {
          const over = r.loads.some((l) => l.percent > 100);
          return (
            <li key={r.id} className={`rounded-[14px] bg-white ${over ? "border-[1.5px] border-[rgba(180,35,35,0.45)]" : "border border-[rgba(52,85,137,0.08)]"}`}>
              <button type="button" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)} className="flex min-h-[64px] w-full flex-col gap-2 px-3.5 py-3 text-left">
                <span className="flex items-center justify-between gap-2">
                  <span>
                    <span className="font-semibold">{r.name}</span> <span className="text-xs text-hx-muted">{r.role}{r.company !== "HarmonyX" ? ` · ${r.company}` : ""}</span>
                  </span>
                  <span className={`text-sm font-extrabold ${r.loads[0].percent > 100 ? "text-hx-over" : "text-hx-blue"}`}>{r.loads[0].percent}%</span>
                </span>
                <span className="grid grid-cols-8 gap-[3px]">
                  {r.loads.map((l, i) => (
                    <span key={l.week} title={cellTitle(heads[i], l)} className={`h-[22px] rounded-[5px] ${heatClass(l.percent)} ${l.hasSoft ? "ring-2 ring-inset ring-hx-gold" : ""}`} />
                  ))}
                </span>
              </button>
              {open === r.id && <Breakdown row={r} />}
            </li>
          );
        })}
      </ul>

      <div className="card hidden overflow-x-auto p-4 lg:block">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-56 px-2 text-left text-xs font-semibold text-hx-muted">บุคลากร</th>
              {heads.map((h) => (
                <th key={h.week} title={h.holidays.join(", ")} className={`text-xs ${h.current ? "font-extrabold text-hx-blue" : "font-semibold text-hx-muted"}`}>
                  {h.label}
                  {h.holidays.length > 0 && <span className="block text-[10px] font-semibold text-hx-gold-text">หยุด {h.holidays.length} วัน</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td className="px-2 py-1">
                  <button type="button" aria-expanded={open === r.id} className="min-h-[44px] text-left" onClick={() => setOpen(open === r.id ? null : r.id)}>
                    <span className="block font-semibold">{r.name}</span>
                    <span className="flex items-center gap-1.5 text-xs text-hx-muted">{r.role}{r.isKeyResource && <span className="pill bg-hx-warn-bg px-2 py-0 text-hx-gold-text">Key</span>}</span>
                  </button>
                </td>
                {r.loads.map((l, i) => (
                  <td key={l.week} title={cellTitle(heads[i], l)} className={`h-11 rounded-lg text-center text-[13px] font-bold ${heatClass(l.percent)} ${l.hasSoft ? "ring-2 ring-inset ring-hx-gold" : ""}`}>
                    {l.percent}%
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {openRow && (
          <div className="mt-4 rounded-xl bg-hx-tint pt-3.5">
            <div className="px-3.5 pb-2 font-bold text-hx-blue">{openRow.name}</div>
            <Breakdown row={openRow} />
          </div>
        )}
      </div>
    </div>
  );
}

function Breakdown({ row }: { row: HeatRow }) {
  if (row.bookings.length === 0) return <p className="px-3.5 pb-3.5 text-sm text-hx-muted">ไม่มี booking ในช่วงนี้</p>;
  return (
    <ul className="flex flex-col gap-2 px-3.5 pb-3.5">
      {row.bookings.map((b) => (
        <li key={b.id} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 ${b.status === "Proposed" ? "border-2 border-dashed border-hx-gold bg-white" : "bg-hx-tint lg:bg-white"}`}>
          <span>
            <span className="block font-semibold">{b.projectName}</span>
            <span className="text-xs text-hx-muted">Rank {b.projectRank} · {b.period}</span>
          </span>
          <span className="flex flex-col items-end gap-1">
            <span className="font-bold">{b.hoursPerWeek} ชม.</span>
            <span className={`pill ${STATUS_PILL[b.status]}`}>{b.status === "Proposed" ? "Soft" : "Hard"}</span>
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
      {items.map(([c, l]) => (
        <span key={l} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${c}`} />{l}</span>
      ))}
    </div>
  );
}
