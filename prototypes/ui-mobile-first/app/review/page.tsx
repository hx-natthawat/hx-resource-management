"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { IconEdit, IconMic } from "@/components/icons";
import { rankCandidates } from "@/lib/domain/capacity";
import type { Booking, Level, Role } from "@/lib/domain/types";
import { projectOf, useStore, YEAR } from "@/lib/state/store";
import { SOURCE_PILL } from "@/lib/ui/heat";
import { formatWeekRange, inferredCount, missing, type DemandDraft, type Field } from "@/lib/voice/extract";

const ROLES: Role[] = ["Solution Architect", "Senior Developer", "Developer", "UX/UI Designer", "QA Engineer", "Project Manager", "Data Engineer", "DevOps Engineer"];
const LEVELS: Level[] = ["Senior", "Mid", "Junior"];

export default function ReviewPage() {
  return (
    <Suspense>
      <Review />
    </Suspense>
  );
}

function Review() {
  const { state, dispatch } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const selected = state.drafts.find((d) => d.id === params.get("id")) ?? state.drafts[0];

  if (!selected) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="h1">ไม่มีรายการรอตรวจ</h1>
        <Link className="btn" href="/voice"><IconMic size={18} />พูดสั่งงานใหม่</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <span className="eyebrow">ตรวจและอนุมัติ</span>
        <h1 className="h1">ระบบกรอกให้แล้ว เหลือเพียงตรวจและกดอนุมัติ</h1>
      </header>

      {state.drafts.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {state.drafts.map((d) => (
            <Link key={d.id} href={`/review?id=${d.id}`} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold no-underline ${d.id === selected.id ? "bg-hx-blue text-white" : "bg-white text-hx-blue"}`}>
              {d.role?.value ?? "ร่าง"} · {d.hoursPerWeek?.value ?? "?"} ชม.
            </Link>
          ))}
        </div>
      )}

      <DraftReview key={selected.id} draft={selected} onApprove={() => { dispatch({ type: "approveDraft", id: selected.id }); router.push("/"); }} onDiscard={() => dispatch({ type: "discardDraft", id: selected.id })} />
    </div>
  );
}

function DraftReview({ draft, onApprove, onDiscard }: { draft: DemandDraft; onApprove: () => void; onDiscard: () => void }) {
  const { state, dispatch } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const gaps = missing(draft);
  const project = draft.projectId && projectOf(state, draft.projectId.value);

  const save = (patch: Partial<DemandDraft>) => {
    dispatch({ type: "saveDraft", draft: { ...draft, ...patch } });
    setEditing(null);
  };
  const edited = <T,>(value: T): Field<T> => ({ value, source: "edited" });

  const complete = gaps.length === 0;
  const fits = complete
    ? rankCandidates(
        { id: "probe", projectId: draft.projectId!.value, role: draft.role!.value, level: draft.level!.value, skills: draft.skills?.value ?? [], personId: null, hoursPerWeek: draft.hoursPerWeek!.value, startWeek: draft.startWeek!.value, endWeek: draft.endWeek!.value, status: "Requested", requestedBy: "", source: "voice" } satisfies Booking,
        state.people,
        state.bookings,
      ).filter((c) => c.fits).length
    : 0;

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
      <div className="flex flex-col gap-4">
        <section className="card flex flex-col gap-3 p-5">
          <span className="eyebrow">สรุปเป็นประโยคเดียว</span>
          <p className="text-lg font-semibold leading-relaxed text-hx-blue lg:text-xl">
            {complete
              ? `ขอ ${draft.role!.value} ระดับ ${draft.level!.value}${draft.skills?.value.length ? ` สาย ${draft.skills.value.join(" และ ")}` : ""} ให้ ${project?.name} ${draft.hoursPerWeek!.value} ชม. ต่อสัปดาห์ ${formatWeekRange(YEAR, draft.startWeek!.value, draft.endWeek!.value)}`
              : `ยังขาดข้อมูล ${gaps.length} ช่อง กลับไปพูดเพิ่ม หรือแก้ในตารางด้านล่าง`}
          </p>
          <div className="flex flex-wrap gap-2">
            {complete && <span className={`pill ${fits ? "bg-hx-ok-bg text-hx-ok" : "bg-hx-over-bg text-hx-over"}`}>{fits ? `มีคนว่างพอ ${fits} คน` : "ยังไม่มีใครว่างพอ"}</span>}
            {inferredCount(draft) > 0 && <span className="pill bg-hx-warn-bg text-hx-gold-text">ระบบตีความ {inferredCount(draft)} ช่อง ควรตรวจ</span>}
          </div>
        </section>

        <section className="card overflow-hidden">
          <ul className="divide-y divide-[rgba(52,85,137,0.08)]">
            <FieldRow label="โครงการ" field={draft.projectId} shown={project?.name} editing={editing === "project"} onEdit={() => setEditing("project")}>
              <select className="input" defaultValue={draft.projectId?.value} onChange={(e) => save({ projectId: edited(e.target.value) })}>
                <option value="">เลือกโครงการ</option>
                {[...state.projects].sort((a, b) => a.rank - b.rank).map((p) => <option key={p.id} value={p.id}>{p.name} · Rank {p.rank}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="Role" field={draft.role} shown={draft.role?.value} editing={editing === "role"} onEdit={() => setEditing("role")}>
              <select className="input" defaultValue={draft.role?.value} onChange={(e) => save({ role: edited(e.target.value as Role) })}>
                <option value="">เลือก Role</option>
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="ระดับ" field={draft.level} shown={draft.level?.value} editing={editing === "level"} onEdit={() => setEditing("level")}>
              <select className="input" defaultValue={draft.level?.value} onChange={(e) => save({ level: edited(e.target.value as Level) })}>
                <option value="">เลือกระดับ</option>
                {LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="Skill" field={draft.skills} shown={draft.skills?.value.join(", ")} editing={editing === "skills"} onEdit={() => setEditing("skills")}>
              <input className="input" defaultValue={draft.skills?.value.join(", ")} onBlur={(e) => save({ skills: edited(e.target.value.split(",").map((s) => s.trim()).filter(Boolean)) })} />
            </FieldRow>
            <FieldRow label="ชั่วโมงต่อสัปดาห์" field={draft.hoursPerWeek} shown={draft.hoursPerWeek && `${draft.hoursPerWeek.value} ชม.`} editing={editing === "hours"} onEdit={() => setEditing("hours")}>
              <input className="input" type="number" min={1} max={40} defaultValue={draft.hoursPerWeek?.value} onBlur={(e) => save({ hoursPerWeek: edited(Number(e.target.value)) })} />
            </FieldRow>
            <FieldRow label="ช่วงเวลา" field={draft.startWeek} shown={draft.startWeek && draft.endWeek && formatWeekRange(YEAR, draft.startWeek.value, draft.endWeek.value)} editing={editing === "weeks"} onEdit={() => setEditing("weeks")}>
              <div className="flex items-center gap-2">
                <input aria-label="สัปดาห์เริ่ม" className="input" type="number" defaultValue={draft.startWeek?.value} onBlur={(e) => save({ startWeek: edited(Number(e.target.value)) })} />
                <span>ถึง</span>
                <input aria-label="สัปดาห์สิ้นสุด" className="input" type="number" defaultValue={draft.endWeek?.value} onBlur={(e) => save({ endWeek: edited(Number(e.target.value)) })} />
              </div>
            </FieldRow>
          </ul>
        </section>
      </div>

      <aside className="flex flex-col gap-3 lg:sticky lg:top-8">
        <section className="card flex flex-col gap-2 p-5">
          <span className="eyebrow">สิ่งที่คุณพูด</span>
          {draft.transcript.map((t, i) => <p key={i} className="text-sm italic text-hx-muted">“{t}”</p>)}
        </section>
        <p className="text-xs text-hx-muted">เมื่ออนุมัติ ระบบสร้างคำขอสถานะ Requested และส่งให้ RM ของทีมที่ดูแล skill นั้น</p>
        <div className="fixed inset-x-0 bottom-[76px] z-10 grid grid-cols-[auto_1fr] gap-2.5 bg-hx-tint/95 px-4 py-3 backdrop-blur lg:static lg:bg-transparent lg:p-0">
          <button type="button" className="btn-ghost" onClick={onDiscard}>ยกเลิก</button>
          <button type="button" className="btn" disabled={!complete} onClick={onApprove}>อนุมัติและส่ง</button>
        </div>
      </aside>
    </div>
  );
}

function FieldRow({ label, field, shown, editing, onEdit, children }: { label: string; field?: Field<unknown>; shown?: string | false; editing: boolean; onEdit: () => void; children: React.ReactNode }) {
  const inferred = field?.source === "inferred";
  return (
    <li className={`flex flex-col gap-2 px-4 py-3 ${inferred ? "bg-hx-warn-row" : ""} ${!field ? "bg-hx-over-bg/40" : ""}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-hx-muted">{label}</div>
          <div className="font-semibold">{shown || <span className="font-normal text-hx-over">ยังไม่มีข้อมูล</span>}</div>
          {field?.heard && <div className="text-xs italic text-hx-muted">ได้ยิน: “{field.heard}”</div>}
        </div>
        {field && <span className={`pill ${SOURCE_PILL[field.source].cls}`}>{SOURCE_PILL[field.source].label}</span>}
        <button type="button" aria-label={`แก้ไข${label}`} onClick={onEdit} className="flex h-11 w-11 items-center justify-center rounded-xl text-hx-blue hover:bg-hx-tint-2"><IconEdit size={18} /></button>
      </div>
      {editing && children}
    </li>
  );
}
