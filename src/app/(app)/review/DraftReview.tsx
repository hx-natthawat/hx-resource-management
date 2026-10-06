"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/AppShell";
import { SOURCE_PILL } from "@/components/heat";
import { IconEdit, IconMic } from "@/components/icons";
import type { DemandDraft, Field } from "@/modules/integration";

export interface ReviewDraft {
  draft: DemandDraft;
  missing: string[];
  problem: string | null;
  fits: number | null;
  inferred: number;
  period: string | null;
  startDate: string;
  endDate: string;
}

type Project = { id: string; name: string; rank: number };

export function DraftReview({ drafts, selectedId, projects, roles, levels }: { drafts: ReviewDraft[]; selectedId?: string; projects: Project[]; roles: string[]; levels: string[] }) {
  const selected = drafts.find((d) => d.draft.id === selectedId) ?? drafts[0];

  if (!selected) {
    return (
      <div className="flex flex-col items-start gap-4">
        <span className="eyebrow">ตรวจและอนุมัติ</span>
        <h1 className="h1">ไม่มีรายการรอตรวจ</h1>
        <p className="text-hx-muted">ร่างที่ระบบกรอกจากเสียงจะมารอให้คุณตรวจที่นี่</p>
        <Link className="btn no-underline" href="/voice"><IconMic size={18} />พูดสั่งงานใหม่</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <span className="eyebrow">ตรวจและอนุมัติ</span>
        <h1 className="h1">ระบบกรอกให้แล้ว เหลือเพียงตรวจและกดอนุมัติ</h1>
      </header>

      {drafts.length > 1 && (
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0" aria-label="ร่างที่รอตรวจ">
          {drafts.map((d) => (
            <Link key={d.draft.id} href={`/review?id=${d.draft.id}`} aria-current={d === selected} className={`flex min-h-[44px] shrink-0 items-center rounded-full px-4 text-sm font-semibold no-underline ${d === selected ? "bg-hx-blue text-white" : "bg-white text-hx-blue"}`}>
              {d.draft.role?.value ?? "ร่าง"} · {d.draft.hoursPerWeek?.value ?? "?"} ชม.
            </Link>
          ))}
        </nav>
      )}

      <Review key={selected.draft.id + JSON.stringify(selected.draft)} item={selected} projects={projects} roles={roles} levels={levels} next={drafts.find((d) => d !== selected)?.draft.id} />
    </div>
  );
}

function Review({ item, projects, roles, levels, next }: { item: ReviewDraft; projects: Project[]; roles: string[]; levels: string[]; next?: string }) {
  const router = useRouter();
  const toast = useToast();
  const { draft } = item;
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const project = projects.find((p) => p.id === draft.projectId?.value);
  const complete = item.missing.length === 0 && !item.problem;

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    const res = await fetch(`/api/drafts/${draft.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) return toast("แก้ไขไม่สำเร็จ ตรวจค่าที่กรอก");
    setEditing(null);
    router.refresh();
  };

  const command = async (action: "approve" | "discard") => {
    setBusy(true);
    const res = await fetch(`/api/drafts/${draft.id}/${action}`, { method: "POST" });
    setBusy(false);
    if (!res.ok) return toast(action === "approve" ? "ยังอนุมัติไม่ได้ ตรวจช่องที่ยังขาด" : "ยกเลิกไม่สำเร็จ");
    toast(action === "approve" ? "ส่งคำขอให้ RM แล้ว สถานะ Requested" : "ยกเลิกร่างแล้ว");
    router.push(next ? `/review?id=${next}` : action === "approve" ? "/" : "/review");
    router.refresh();
  };

  const summary = complete
    ? `ขอ ${draft.role!.value} ระดับ ${draft.level!.value}${draft.skills?.value.length ? ` สาย ${draft.skills.value.join(" และ ")}` : ""} ให้ ${project?.name} ${draft.hoursPerWeek!.value} ชม. ต่อสัปดาห์ ${item.period}`
    : item.problem === "end_before_start"
      ? "วันสิ้นสุดอยู่ก่อนวันเริ่ม แก้ช่วงเวลาก่อนอนุมัติ"
      : `ยังขาดข้อมูล ${item.missing.length} ช่อง กลับไปพูดเพิ่ม หรือแก้ในรายการด้านล่าง`;

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
      <div className="flex flex-col gap-4">
        <section className="card flex flex-col gap-3 p-5">
          <span className="eyebrow">สรุปเป็นประโยคเดียว</span>
          <p className="text-lg font-semibold leading-relaxed text-hx-blue lg:text-xl">{summary}</p>
          <div className="flex flex-wrap gap-2">
            {item.fits !== null && <span className={`pill ${item.fits ? "bg-hx-ok-bg text-hx-ok" : "bg-hx-over-bg text-hx-over"}`}>{item.fits ? `มีคนว่างพอ ${item.fits} คน` : "ยังไม่มีใครว่างพอ RM จะหาทางเลือก"}</span>}
            {item.inferred > 0 && <span className="pill bg-hx-warn-bg text-hx-gold-text">ระบบตีความ {item.inferred} ช่อง ควรตรวจ</span>}
          </div>
        </section>

        <section className="card overflow-hidden">
          <ul className="divide-y divide-[rgba(52,85,137,0.08)]">
            <FieldRow label="โครงการ" field={draft.projectId} shown={project?.name} editing={editing === "project"} onEdit={() => setEditing("project")}>
              <select className="input" defaultValue={draft.projectId?.value ?? ""} disabled={busy} onChange={(e) => e.target.value && patch({ projectId: e.target.value })}>
                <option value="">เลือกโครงการ</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name} · Rank {p.rank}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="Role" field={draft.role} shown={draft.role?.value} editing={editing === "role"} onEdit={() => setEditing("role")}>
              <select className="input" defaultValue={draft.role?.value ?? ""} disabled={busy} onChange={(e) => e.target.value && patch({ role: e.target.value })}>
                <option value="">เลือก Role</option>
                {roles.map((r) => <option key={r}>{r}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="ระดับ" field={draft.level} shown={draft.level?.value} editing={editing === "level"} onEdit={() => setEditing("level")}>
              <select className="input" defaultValue={draft.level?.value ?? ""} disabled={busy} onChange={(e) => e.target.value && patch({ level: e.target.value })}>
                <option value="">เลือกระดับ</option>
                {levels.map((l) => <option key={l}>{l}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="Skill" field={draft.skills} shown={draft.skills?.value.join(", ")} optional editing={editing === "skills"} onEdit={() => setEditing("skills")}>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get("skills") as string; patch({ skills: v.split(",").map((s) => s.trim()).filter(Boolean) }); }}>
                <input name="skills" className="input" defaultValue={draft.skills?.value.join(", ")} placeholder="Integration, AWS" />
                <button className="btn" disabled={busy}>บันทึก</button>
              </form>
            </FieldRow>
            <FieldRow label="ชั่วโมงต่อสัปดาห์" field={draft.hoursPerWeek} shown={draft.hoursPerWeek && `${draft.hoursPerWeek.value} ชม.`} editing={editing === "hours"} onEdit={() => setEditing("hours")}>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); patch({ hoursPerWeek: Number(new FormData(e.currentTarget).get("hours")) }); }}>
                <input name="hours" className="input" type="number" inputMode="numeric" min={1} max={40} required defaultValue={draft.hoursPerWeek?.value} />
                <button className="btn" disabled={busy}>บันทึก</button>
              </form>
            </FieldRow>
            <FieldRow label="ช่วงเวลา" field={draft.startWeek} shown={item.period} editing={editing === "weeks"} onEdit={() => setEditing("weeks")}>
              <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); patch({ startDate: f.get("start"), endDate: f.get("end") }); }}>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-xs text-hx-muted">เริ่ม<input name="start" className="input" type="date" required defaultValue={item.startDate} /></label>
                  <label className="flex flex-col gap-1 text-xs text-hx-muted">ถึง<input name="end" className="input" type="date" required defaultValue={item.endDate} /></label>
                </div>
                <button className="btn" disabled={busy}>บันทึก</button>
              </form>
            </FieldRow>
          </ul>
        </section>
      </div>

      <aside className="flex flex-col gap-3 lg:sticky lg:top-8">
        <section className="card flex flex-col gap-2 p-5">
          <span className="eyebrow">สิ่งที่คุณพูด</span>
          {draft.transcript.map((t, i) => <p key={i} className="text-sm italic text-hx-muted">“{t}”</p>)}
          <Link href="/voice" className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-hx-blue"><IconMic size={16} />พูดรายการใหม่</Link>
        </section>
        <p className="text-xs text-hx-muted">เมื่ออนุมัติ ระบบสร้างคำขอสถานะ Requested โดยยังไม่ระบุชื่อคน และส่งให้ RM พิจารณา</p>
        <div className="fixed inset-x-0 bottom-[76px] z-10 grid grid-cols-[auto_1fr] gap-2.5 bg-hx-tint/95 px-4 py-3 backdrop-blur lg:static lg:bg-transparent lg:p-0">
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => command("discard")}>ยกเลิก</button>
          <button type="button" className="btn" disabled={busy || !complete} onClick={() => command("approve")}>อนุมัติและส่ง</button>
        </div>
      </aside>
    </div>
  );
}

function FieldRow({ label, field, shown, optional, editing, onEdit, children }: { label: string; field?: Field<unknown>; shown?: string | false | null; optional?: boolean; editing: boolean; onEdit: () => void; children: React.ReactNode }) {
  const inferred = field?.source === "inferred";
  const empty = !field && !optional;
  return (
    <li className={`flex flex-col gap-2 px-4 py-3 ${inferred ? "bg-hx-warn-row" : ""} ${empty ? "bg-hx-over-bg/40" : ""}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-hx-muted">{label}</div>
          <div className="font-semibold">{shown || <span className={`font-normal ${empty ? "text-hx-over" : "text-hx-muted"}`}>{empty ? "ยังไม่มีข้อมูล" : "ไม่ระบุ"}</span>}</div>
          {field?.heard && <div className="text-xs italic text-hx-muted">ได้ยิน: “{field.heard}”</div>}
        </div>
        {field && <span className={`pill ${SOURCE_PILL[field.source].cls}`}>{SOURCE_PILL[field.source].label}</span>}
        <button type="button" aria-label={`แก้ไข${label}`} aria-expanded={editing} onClick={onEdit} className="flex h-11 w-11 items-center justify-center rounded-xl text-hx-blue hover:bg-hx-tint-2"><IconEdit size={18} /></button>
      </div>
      {editing && children}
    </li>
  );
}
