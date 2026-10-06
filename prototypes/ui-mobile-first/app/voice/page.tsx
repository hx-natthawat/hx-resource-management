"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconMic, IconSend } from "@/components/icons";
import { rankCandidates } from "@/lib/domain/capacity";
import type { Booking } from "@/lib/domain/types";
import { newId, projectOf, ROLE_LABEL, TODAY, useStore, YEAR } from "@/lib/state/store";
import { SOURCE_PILL } from "@/lib/ui/heat";
import { extract, formatWeekRange, missing, nextQuestion, type DemandDraft } from "@/lib/voice/extract";
import { useSpeech } from "@/lib/voice/useSpeech";

type Msg = { from: "me" | "ai"; text: string; done?: boolean };

const EXAMPLES = [
  "ขอ architect สายระบบ integration ให้ CRM ภาครัฐ สองวันต่อสัปดาห์ ปลายตุลาถึงกลางพฤศจิกา",
  "ซีเนียร์ เน้น AWS ด้วย",
  "ขอ QA ให้ AI Platform เต็มเวลา เดือนหน้า",
];

export default function VoicePage() {
  const { state, dispatch } = useStore();
  const router = useRouter();
  const [draft, setDraft] = useState<DemandDraft | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "ai", text: "พูดสิ่งที่ต้องการได้เลยครับ เช่น ขอคนตำแหน่งอะไร ให้โครงการไหน กี่วันต่อสัปดาห์ และช่วงเวลาใด" }]);
  const [text, setText] = useState("");
  const speech = useSpeech((finalText) => handle(finalText));
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);

  function handle(utterance: string) {
    const u = utterance.trim();
    if (!u) return;
    const ctx = { projects: state.projects, requestedBy: ROLE_LABEL.PM.who, year: YEAR, today: TODAY, newId: () => newId("d") };
    const next = extract(u, ctx, draft ?? undefined);
    setDraft(next);
    dispatch({ type: "saveDraft", draft: next });
    const q = nextQuestion(next);
    let reply: Msg;
    if (q) {
      const filled = 6 - missing(next).length;
      reply = { from: "ai", text: `กรอกให้แล้ว ${filled} จาก 6 ช่อง ${q}` };
    } else {
      const probe: Booking = {
        id: "probe", projectId: next.projectId!.value, role: next.role!.value, level: next.level!.value, skills: next.skills?.value ?? [],
        personId: null, hoursPerWeek: next.hoursPerWeek!.value, startWeek: next.startWeek!.value, endWeek: next.endWeek!.value,
        status: "Requested", requestedBy: "", source: "voice",
      };
      const fits = rankCandidates(probe, state.people, state.bookings).filter((c) => c.fits);
      const who = fits.slice(0, 2).map((c) => c.person.name).join(" และ ");
      reply = { from: "ai", text: fits.length ? `ครบทุกช่องแล้ว ${who} ว่างพอ` : "ครบทุกช่องแล้ว แต่ตอนนี้ยังไม่มีใครว่างพอ RM จะช่วยหาทางเลือก", done: true };
    }
    setMsgs((m) => [...m, { from: "me", text: u }, reply]);
    setText("");
  }

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <span className="eyebrow">สั่งงานด้วยเสียง</span>
          <h1 className="h1">พูดสิ่งที่ต้องการ ระบบกรอกให้</h1>
          <p className="text-sm text-hx-muted">ไม่มีอะไรบันทึกจนกว่าจะกดอนุมัติในหน้าตรวจ</p>
        </header>

        <div className="flex flex-col gap-3" aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={m.from === "me" ? "max-w-[85%] self-end rounded-[16px_16px_4px_16px] bg-hx-blue px-4 py-3 text-white" : "max-w-[85%] self-start rounded-[16px_16px_16px_4px] border border-[rgba(52,85,137,0.12)] bg-white px-4 py-3"}>
              {m.text}
              {m.done && draft && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn" onClick={() => router.push(`/review?id=${draft.id}`)}>ตรวจและอนุมัติ</button>
                  <button type="button" className="btn-ghost" onClick={() => { setDraft(null); setMsgs((x) => [...x, { from: "ai", text: "เริ่มรายการใหม่ได้เลยครับ" }]); }}>รายการใหม่</button>
                </div>
              )}
            </div>
          ))}
          {speech.interim && <div className="max-w-[85%] self-end rounded-2xl bg-hx-sky px-4 py-3 text-hx-blue-deep">{speech.interim}</div>}
          <div ref={endRef} />
        </div>

        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" onClick={() => handle(e)} className="min-h-[40px] rounded-full border border-[rgba(52,85,137,0.2)] bg-white px-3.5 text-left text-[13px] text-hx-blue hover:bg-hx-tint-2">
              ลองพูด: {e}
            </button>
          ))}
        </div>

        <div className="sticky bottom-24 z-10 flex items-center gap-3 rounded-2xl border border-[rgba(52,85,137,0.12)] bg-white p-3 shadow-card lg:bottom-6">
          <button
            type="button"
            aria-label={speech.listening ? "ปล่อยเพื่อส่ง" : "กดค้างเพื่อพูด"}
            aria-pressed={speech.listening}
            disabled={!speech.supported}
            onPointerDown={speech.start}
            onPointerUp={speech.stop}
            onPointerLeave={() => speech.listening && speech.stop()}
            className={`flex h-16 w-16 shrink-0 touch-none select-none items-center justify-center rounded-full text-white transition ${speech.listening ? "scale-110 bg-hx-over" : "bg-hx-gold"} disabled:opacity-40`}
          >
            <IconMic size={28} />
          </button>
          <form className="flex flex-1 items-center gap-2" onSubmit={(e) => { e.preventDefault(); handle(text); }}>
            <label className="sr-only" htmlFor="say">พิมพ์แทนการพูด</label>
            <input id="say" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={speech.supported ? "กดค้างที่ไมค์ หรือพิมพ์แทน" : "เบราว์เซอร์นี้ไม่รองรับเสียง พิมพ์แทนได้"} />
            <button type="submit" aria-label="ส่ง" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-hx-tint-2 text-hx-blue"><IconSend size={20} /></button>
          </form>
        </div>
      </section>

      <aside className="card flex flex-col gap-2 p-5" aria-label="ร่างที่ระบบกรอกให้">
        <div className="flex items-center justify-between">
          <span className="eyebrow">ร่าง Demand</span>
          {draft && <span className={`pill ${missing(draft).length ? "bg-hx-warn-bg text-hx-gold-text" : "bg-hx-ok-bg text-hx-ok"}`}>ครบ {6 - missing(draft).length} จาก 6</span>}
        </div>
        {!draft && <p className="text-sm text-hx-muted">ช่องต่างๆ จะถูกกรอกขณะที่คุณพูด</p>}
        {draft && (
          <dl className="flex flex-col">
            <Row k="โครงการ" f={draft.projectId} v={draft.projectId && projectOf(state, draft.projectId.value)?.name} />
            <Row k="Role" f={draft.role} v={draft.role?.value} />
            <Row k="ระดับ" f={draft.level} v={draft.level?.value} />
            <Row k="Skill" f={draft.skills} v={draft.skills?.value.join(", ")} />
            <Row k="ชั่วโมงต่อสัปดาห์" f={draft.hoursPerWeek} v={draft.hoursPerWeek && `${draft.hoursPerWeek.value} ชม.`} />
            <Row k="ช่วงเวลา" f={draft.startWeek} v={draft.startWeek && draft.endWeek && formatWeekRange(YEAR, draft.startWeek.value, draft.endWeek.value)} />
          </dl>
        )}
        <Link href="/review" className="mt-2 text-sm font-semibold text-hx-blue">ดูรายการรอตรวจทั้งหมด</Link>
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
