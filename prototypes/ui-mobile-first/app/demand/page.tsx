"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconMic } from "@/components/icons";
import type { Level, Role } from "@/lib/domain/types";
import { newId, ROLE_LABEL, useStore } from "@/lib/state/store";

const ROLES: Role[] = ["Solution Architect", "Senior Developer", "Developer", "UX/UI Designer", "QA Engineer", "Project Manager", "Data Engineer", "DevOps Engineer"];

export default function DemandPage() {
  const { state, dispatch } = useStore();
  const router = useRouter();
  const [form, setForm] = useState({ projectId: "crm", role: ROLES[0] as Role, level: "Senior" as Level, skills: "", hours: 16, start: 43, end: 46, note: "" });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <header>
        <span className="eyebrow">ทางสำรอง</span>
        <h1 className="h1">ส่ง Demand ด้วยฟอร์ม</h1>
        <p className="text-[13px] text-hx-muted">เร็วกว่าถ้า <Link href="/voice" className="font-semibold"><IconMic size={14} className="inline" /> พูดสั่ง</Link></p>
      </header>
      <form
        className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          dispatch({
            type: "createBooking",
            booking: { id: newId("b"), projectId: form.projectId, role: form.role, level: form.level, skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean), personId: null, hoursPerWeek: form.hours, startWeek: form.start, endWeek: form.end, status: "Requested", requestedBy: ROLE_LABEL.PM.who, note: form.note, source: "form" },
          });
          router.push("/");
        }}
      >
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-hx-blue sm:col-span-2">โครงการ
          <select className="input font-normal" value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
            {[...state.projects].sort((a, b) => a.rank - b.rank).map((p) => <option key={p.id} value={p.id}>{p.name} · Rank {p.rank}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-hx-blue">Role
          <select className="input font-normal" value={form.role} onChange={(e) => set("role", e.target.value as Role)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-hx-blue">ระดับ
          <select className="input font-normal" value={form.level} onChange={(e) => set("level", e.target.value as Level)}>{(["Senior", "Mid", "Junior"] as Level[]).map((l) => <option key={l}>{l}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-hx-blue sm:col-span-2">Skill (คั่นด้วยจุลภาค)
          <input className="input font-normal" value={form.skills} onChange={(e) => set("skills", e.target.value)} placeholder="Integration, AWS" />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-hx-blue">ชั่วโมงต่อสัปดาห์
          <input className="input font-normal" type="number" min={1} max={40} value={form.hours} onChange={(e) => set("hours", Number(e.target.value))} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-hx-blue">เริ่ม (สัปดาห์)
            <input className="input font-normal" type="number" value={form.start} onChange={(e) => set("start", Number(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-hx-blue">สิ้นสุด
            <input className="input font-normal" type="number" value={form.end} onChange={(e) => set("end", Number(e.target.value))} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-hx-blue sm:col-span-2">งานที่จะทำ
          <textarea className="input py-3 font-normal" rows={3} value={form.note} onChange={(e) => set("note", e.target.value)} />
        </label>
        <button type="submit" className="btn sm:col-span-2">ส่งคำขอให้ RM</button>
      </form>
    </div>
  );
}
