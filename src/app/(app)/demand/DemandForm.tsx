"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/AppShell";
import { IconMic } from "@/components/icons";

interface Props {
  projects: { id: string; name: string; rank: number }[];
  roles: string[];
  levels: string[];
  allowed: boolean;
}

const label = "flex flex-col gap-1.5 text-[13px] font-semibold text-hx-blue";

export function DemandForm({ projects, roles, levels, allowed }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ projectId: projects[0]?.id ?? "", role: roles[0], level: "Senior", skills: "", hours: 16, startDate: "", endDate: "", note: "" });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.projectId && form.startDate && form.endDate && form.endDate >= form.startDate && form.hours >= 1 && form.hours <= 40;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/demands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: form.projectId,
        role: form.role,
        level: form.level,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        hoursPerWeek: form.hours,
        startDate: form.startDate,
        endDate: form.endDate,
        note: form.note || undefined,
      }),
    });
    setBusy(false);
    if (res.ok) {
      toast("ส่งคำขอให้ RM แล้ว");
      router.push("/");
      router.refresh();
    } else toast("ส่งคำขอไม่สำเร็จ ตรวจข้อมูลอีกครั้ง");
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <header>
        <span className="eyebrow">ทางสำรอง</span>
        <h1 className="h1">ส่ง Demand ด้วยฟอร์ม</h1>
        <p className="text-[13px] text-hx-muted">
          ขอคนตาม role และ skill โดยไม่ต้องระบุชื่อ RM จะเสนอชื่อให้ เร็วกว่าถ้า{" "}
          <Link href="/voice" className="font-semibold"><IconMic size={14} className="inline" /> พูดสั่ง</Link>
        </p>
      </header>
      {!allowed && <p className="rounded-xl bg-hx-warn-bg p-3 text-sm text-hx-gold-text">บทบาทนี้ส่ง Demand ไม่ได้</p>}
      <form className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2" onSubmit={submit}>
        <label className={`${label} sm:col-span-2`}>โครงการ
          <select className="input font-normal" value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name} · Rank {p.rank}</option>)}
          </select>
        </label>
        <label className={label}>Role
          <select className="input font-normal" value={form.role} onChange={(e) => set("role", e.target.value)}>{roles.map((r) => <option key={r}>{r}</option>)}</select>
        </label>
        <label className={label}>ระดับ
          <select className="input font-normal" value={form.level} onChange={(e) => set("level", e.target.value)}>{levels.map((l) => <option key={l}>{l}</option>)}</select>
        </label>
        <label className={`${label} sm:col-span-2`}>Skill (คั่นด้วยจุลภาค)
          <input className="input font-normal" value={form.skills} onChange={(e) => set("skills", e.target.value)} placeholder="Integration, AWS" />
        </label>
        <label className={label}>ชั่วโมงต่อสัปดาห์
          <input className="input font-normal" type="number" inputMode="numeric" min={1} max={40} value={form.hours} onChange={(e) => set("hours", Number(e.target.value))} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className={label}>เริ่ม
            <input className="input font-normal" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </label>
          <label className={label}>สิ้นสุด
            <input className="input font-normal" type="date" min={form.startDate || undefined} value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
          </label>
        </div>
        <label className={`${label} sm:col-span-2`}>งานที่จะทำ
          <textarea className="input py-3 font-normal" rows={3} value={form.note} onChange={(e) => set("note", e.target.value)} />
        </label>
        <button type="submit" className="btn sm:col-span-2" disabled={!allowed || !valid || busy}>ส่งคำขอให้ RM</button>
      </form>
    </div>
  );
}
