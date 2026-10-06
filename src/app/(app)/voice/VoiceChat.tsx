"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SOURCE_PILL } from "@/components/heat";
import { IconMic, IconSend } from "@/components/icons";
import { useSpeech } from "@/components/useSpeech";
import { REQUIRED, type DemandDraft } from "@/modules/integration";
import { formatWeekRange } from "@/modules/people";

type Msg = { from: "me" | "ai"; text: string; done?: boolean };

export function VoiceChat({ projects, openCount, examples }: { projects: { id: string; name: string; rank: number }[]; openCount: number; examples: string[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<DemandDraft | null>(null);
  const [gaps, setGaps] = useState<string[]>([...REQUIRED]);
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "ai", text: "พูดสิ่งที่ต้องการได้เลยครับ เช่น ขอคนตำแหน่งอะไร ให้โครงการไหน กี่วันต่อสัปดาห์ และช่วงเวลาใด" }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const speech = useSpeech((finalText) => handle(finalText));
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [msgs]);

  async function handle(utterance: string) {
    const u = utterance.trim();
    if (!u || busy) return;
    setBusy(true);
    setMsgs((m) => [...m, { from: "me", text: u }]);
    setText("");
    const res = await fetch("/api/voice/say", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ draftId: draft?.id, text: u }) });
    setBusy(false);
    if (!res.ok) {
      setMsgs((m) => [...m, { from: "ai", text: "บันทึกร่างไม่สำเร็จ ลองอีกครั้งครับ" }]);
      return;
    }
    const body = (await res.json()) as { draft: DemandDraft; missing: string[]; question: string | null };
    setDraft(body.draft);
    setGaps(body.missing);
    const filled = REQUIRED.length - body.missing.length;
    setMsgs((m) => [
      ...m,
      body.question
        ? { from: "ai", text: `กรอกให้แล้ว ${filled} จาก ${REQUIRED.length} ช่อง ${body.question}` }
        : { from: "ai", text: "ครบทุกช่องแล้ว ตรวจความถูกต้องแล้วกดอนุมัติเพื่อส่งให้ RM", done: true },
    ]);
    router.refresh();
  }

  const projectName = (id?: string) => projects.find((p) => p.id === id)?.name;

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <span className="eyebrow">สั่งงานด้วยเสียง</span>
          <h1 className="h1">พูดสิ่งที่ต้องการ ระบบกรอกให้</h1>
          <p className="text-sm text-hx-muted">ยังไม่มีคำขอใดถูกส่งจนกว่าคุณกดอนุมัติในหน้าตรวจ ระบบไม่เก็บไฟล์เสียง</p>
        </header>

        <div className="flex flex-col gap-3" aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={m.from === "me" ? "max-w-[85%] self-end rounded-[16px_16px_4px_16px] bg-hx-blue px-4 py-3 text-white" : "max-w-[85%] self-start rounded-[16px_16px_16px_4px] border border-[rgba(52,85,137,0.12)] bg-white px-4 py-3"}>
              {m.text}
              {m.done && draft && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link className="btn no-underline" href={`/review?id=${draft.id}`}>ตรวจและอนุมัติ</Link>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setDraft(null);
                      setGaps([...REQUIRED]);
                      setMsgs((x) => [...x, { from: "ai", text: "เริ่มรายการใหม่ได้เลยครับ ร่างเดิมยังรออยู่ในหน้าตรวจ" }]);
                    }}
                  >
                    รายการใหม่
                  </button>
                </div>
              )}
            </div>
          ))}
          {busy && <div className="self-start rounded-2xl bg-white px-4 py-3 text-hx-muted">กำลังกรอกให้</div>}
          {speech.interim && <div className="max-w-[85%] self-end rounded-2xl bg-hx-sky px-4 py-3 text-hx-blue-deep">{speech.interim}</div>}
          <div ref={endRef} />
        </div>

        {!draft && (
          <div className="flex flex-wrap gap-2">
            {examples.map((e) => (
              <button key={e} type="button" onClick={() => handle(e)} className="min-h-[44px] rounded-2xl border border-[rgba(52,85,137,0.2)] bg-white px-3.5 py-2 text-left text-[13px] text-hx-blue hover:bg-hx-tint-2">
                ลองพูด: {e}
              </button>
            ))}
          </div>
        )}

        <div className="sticky bottom-24 z-10 flex items-center gap-3 rounded-2xl border border-[rgba(52,85,137,0.12)] bg-white p-3 shadow-card lg:bottom-6">
          <button
            type="button"
            aria-label={speech.listening ? "ปล่อยเพื่อส่ง" : "กดค้างเพื่อพูด"}
            aria-pressed={speech.listening}
            disabled={!speech.supported || busy}
            onPointerDown={speech.start}
            onPointerUp={speech.stop}
            onPointerLeave={() => speech.listening && speech.stop()}
            className={`flex h-16 w-16 shrink-0 touch-none select-none items-center justify-center rounded-full text-white transition ${speech.listening ? "scale-110 bg-hx-over" : "bg-hx-gold"} disabled:opacity-40`}
          >
            <IconMic size={28} />
          </button>
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handle(text);
            }}
          >
            <label className="sr-only" htmlFor="say">พิมพ์แทนการพูด</label>
            <input id="say" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={speech.supported ? "กดค้างที่ไมค์ หรือพิมพ์แทน" : "เบราว์เซอร์นี้ไม่รองรับเสียง พิมพ์แทนได้"} />
            <button type="submit" aria-label="ส่ง" disabled={busy} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-hx-tint-2 text-hx-blue"><IconSend size={20} /></button>
          </form>
        </div>
      </section>

      <aside className="card flex flex-col gap-2 p-5" aria-label="ร่างที่ระบบกรอกให้">
        <div className="flex items-center justify-between">
          <span className="eyebrow">ร่าง Demand</span>
          {draft && <span className={`pill ${gaps.length ? "bg-hx-warn-bg text-hx-gold-text" : "bg-hx-ok-bg text-hx-ok"}`}>ครบ {REQUIRED.length - gaps.length} จาก {REQUIRED.length}</span>}
        </div>
        {!draft && <p className="text-sm text-hx-muted">ช่องต่างๆ จะถูกกรอกขณะที่คุณพูด</p>}
        {draft && (
          <dl className="flex flex-col">
            <Row k="โครงการ" f={draft.projectId} v={projectName(draft.projectId?.value)} />
            <Row k="Role" f={draft.role} v={draft.role?.value} />
            <Row k="ระดับ" f={draft.level} v={draft.level?.value} />
            <Row k="Skill" f={draft.skills} v={draft.skills?.value.join(", ")} />
            <Row k="ชั่วโมงต่อสัปดาห์" f={draft.hoursPerWeek} v={draft.hoursPerWeek && `${draft.hoursPerWeek.value} ชม.`} />
            <Row k="ช่วงเวลา" f={draft.startWeek} v={draft.startWeek && draft.endWeek && formatWeekRange(draft.startWeek.value, draft.endWeek.value)} />
          </dl>
        )}
        <Link href="/review" className="mt-2 flex min-h-[44px] items-center text-sm font-semibold text-hx-blue">
          ดูรายการรอตรวจทั้งหมด{openCount ? ` (${openCount})` : ""}
        </Link>
      </aside>
    </div>
  );
}

function Row({ k, v, f }: { k: string; v?: string | false; f?: { source: keyof typeof SOURCE_PILL } }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[rgba(52,85,137,0.08)] py-2.5">
      <div>
        <dt className="text-xs text-hx-muted">{k}</dt>
        <dd className="font-semibold">{v || <span className="font-normal text-hx-muted">รอข้อมูล</span>}</dd>
      </div>
      {f && <span className={`pill ${SOURCE_PILL[f.source].cls}`}>{SOURCE_PILL[f.source].label}</span>}
    </div>
  );
}
