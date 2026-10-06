"use client";

import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import { transition } from "../domain/booking";
import { loadAfter } from "../domain/capacity";
import { moveRank } from "../domain/rank";
import type { Booking, Decision, DecisionKind, Person, Project } from "../domain/types";
import { extract, missing, type DemandDraft } from "../voice/extract";
import { SEED_BOOKINGS, SEED_PEOPLE, SEED_PROJECTS } from "./seed";

export type AppRole = "PM" | "RM" | "Council" | "Executive";

export const ROLE_LABEL: Record<AppRole, { th: string; who: string }> = {
  PM: { th: "Project Manager", who: "ณัฐวุฒิ จ." },
  RM: { th: "Resource Manager", who: "RM ทีม Engineering" },
  Council: { th: "Resource Council", who: "ประธาน Council" },
  Executive: { th: "ผู้บริหาร", who: "CEO" },
};

export const YEAR = 2026;
export const TODAY = new Date(Date.UTC(2026, 9, 6));

export interface State {
  role: AppRole;
  people: Person[];
  projects: Project[];
  bookings: Booking[];
  drafts: DemandDraft[];
  decisions: Decision[];
  ranksPublishedAt: string | null;
  toast: string | null;
}

export type Action =
  | { type: "setRole"; role: AppRole }
  | { type: "saveDraft"; draft: DemandDraft }
  | { type: "discardDraft"; id: string }
  | { type: "approveDraft"; id: string }
  | { type: "approveBooking"; bookingId: string; personId: string }
  | { type: "rejectBooking"; bookingId: string }
  | { type: "decide"; decision: Omit<Decision, "id" | "decidedAt">; bookingId: string; substituteId?: string; shiftWeeks?: number }
  | { type: "moveRank"; projectId: string; direction: -1 | 1 }
  | { type: "publishRanks" }
  | { type: "createBooking"; booking: Booking }
  | { type: "dismissToast" };

let seq = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++seq}`;

function seedDraft(): DemandDraft {
  const ctx = { projects: SEED_PROJECTS, requestedBy: ROLE_LABEL.PM.who, year: YEAR, today: TODAY, newId: () => "d-seed" };
  const first = extract("ขอ architect สายระบบ integration ให้โปรเจกต์ CRM ภาครัฐ สักสองวันต่อสัปดาห์ ช่วงปลายเดือนตุลาถึงกลางพฤศจิกา", ctx);
  return extract("ซีเนียร์ เน้น AWS ด้วย", ctx, first);
}

const initial: State = {
  role: "PM",
  people: SEED_PEOPLE,
  projects: SEED_PROJECTS,
  bookings: SEED_BOOKINGS,
  drafts: [seedDraft()],
  decisions: [],
  ranksPublishedAt: null,
  toast: null,
};

function replaceBooking(bookings: Booking[], next: Booking) {
  return bookings.map((b) => (b.id === next.id ? next : b));
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "setRole":
      return { ...state, role: action.role };
    case "saveDraft": {
      const exists = state.drafts.some((d) => d.id === action.draft.id);
      return { ...state, drafts: exists ? state.drafts.map((d) => (d.id === action.draft.id ? action.draft : d)) : [action.draft, ...state.drafts] };
    }
    case "discardDraft":
      return { ...state, drafts: state.drafts.filter((d) => d.id !== action.id), toast: "ยกเลิกรายการแล้ว" };
    case "approveDraft": {
      const d = state.drafts.find((x) => x.id === action.id);
      if (!d || missing(d).length) return { ...state, toast: "ข้อมูลยังไม่ครบ" };
      const booking: Booking = {
        id: newId("b"),
        projectId: d.projectId!.value,
        role: d.role!.value,
        level: d.level!.value,
        skills: d.skills?.value ?? [],
        personId: null,
        hoursPerWeek: d.hoursPerWeek!.value,
        startWeek: d.startWeek!.value,
        endWeek: d.endWeek!.value,
        status: "Requested",
        requestedBy: d.requestedBy.value,
        note: d.transcript.join(" · "),
        source: "voice",
      };
      return { ...state, bookings: [...state.bookings, booking], drafts: state.drafts.filter((x) => x.id !== d.id), toast: "ส่งคำขอให้ RM แล้ว" };
    }
    case "approveBooking": {
      const b = state.bookings.find((x) => x.id === action.bookingId);
      const person = state.people.find((p) => p.id === action.personId);
      if (!b || !person) return state;
      const others = state.bookings.filter((x) => x.id !== b.id);
      if (loadAfter(person, others, b) > 100) return { ...state, toast: `${person.name} จะเกิน capacity จึงยืนยันไม่ได้` };
      const proposed = transition(b, { type: "propose", personId: person.id });
      if (!proposed.ok) return { ...state, toast: proposed.error };
      const confirmed = transition(proposed.booking, { type: "confirm" });
      if (!confirmed.ok) return { ...state, toast: confirmed.error };
      return { ...state, bookings: replaceBooking(state.bookings, confirmed.booking), toast: `ยืนยัน ${person.name} แล้ว (Hard booking)` };
    }
    case "rejectBooking": {
      const b = state.bookings.find((x) => x.id === action.bookingId);
      if (!b) return state;
      const r = transition(b, { type: "reject" });
      return r.ok ? { ...state, bookings: replaceBooking(state.bookings, r.booking), toast: "ปฏิเสธคำขอแล้ว" } : { ...state, toast: r.error };
    }
    case "decide": {
      const b = state.bookings.find((x) => x.id === action.bookingId);
      if (!b) return state;
      const kind: DecisionKind = action.decision.kind;
      const next: Booking =
        kind === "shift"
          ? { ...b, startWeek: b.startWeek + (action.shiftWeeks ?? 1), endWeek: b.endWeek + (action.shiftWeeks ?? 1) }
          : kind === "substitute"
            ? { ...b, personId: action.substituteId ?? b.personId }
            : { ...b, hoursPerWeek: Math.max(4, Math.round(b.hoursPerWeek / 2)) };
      const decision: Decision = { ...action.decision, id: newId("dec"), decidedAt: TODAY.toISOString() };
      return { ...state, bookings: replaceBooking(state.bookings, next), decisions: [decision, ...state.decisions], toast: "บันทึกการตัดสินแล้ว" };
    }
    case "moveRank":
      return { ...state, projects: moveRank(state.projects, action.projectId, action.direction), ranksPublishedAt: null };
    case "publishRanks":
      return { ...state, ranksPublishedAt: TODAY.toISOString(), toast: "ประกาศ Rank รอบนี้แล้ว" };
    case "createBooking":
      return { ...state, bookings: [...state.bookings, action.booking], toast: "ส่งคำขอให้ RM แล้ว" };
    case "dismissToast":
      return { ...state, toast: null };
  }
}

const Ctx = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}

export const projectOf = (state: State, id: string) => state.projects.find((p) => p.id === id);
export const personOf = (state: State, id: string | null) => state.people.find((p) => p.id === id);
