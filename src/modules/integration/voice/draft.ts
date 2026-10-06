import type { Level, Role } from "../../people/types";
import type { Week } from "../../people/week";
import { missing, type DemandDraft, type ExtractContext, type RequiredKey } from "./extract";

/** ADR-008: anything that turns one utterance into draft fields. The rule-based `extract` is today's implementation. */
export type Extractor = (utterance: string, ctx: ExtractContext, prev?: DemandDraft) => DemandDraft;

export interface DraftEdits {
  projectId?: string;
  role?: Role;
  level?: Level;
  skills?: string[];
  hoursPerWeek?: number;
  startWeek?: Week;
  endWeek?: Week;
}

/** A person's correction always wins and is marked `edited`, so the review screen shows who said what. */
export function applyEdits(draft: DemandDraft, edits: DraftEdits): DemandDraft {
  const next: DemandDraft = { ...draft };
  for (const key of Object.keys(edits) as (keyof DraftEdits)[]) {
    const value = edits[key];
    if (value === undefined) continue;
    (next as unknown as Record<string, unknown>)[key] = { value, source: "edited" };
  }
  return next;
}

export interface ApprovedDemand {
  projectId: string;
  role: Role;
  level: Level;
  skills: string[];
  hoursPerWeek: number;
  startWeek: Week;
  endWeek: Week;
}

export type DraftCheck = { ok: true; demand: ApprovedDemand } | { ok: false; missing: RequiredKey[]; problem?: "end_before_start" | "hours_out_of_range" };

/** A draft can be approved only when every required field is present and sensible. */
export function draftToDemand(d: DemandDraft): DraftCheck {
  const gaps = missing(d);
  if (gaps.length) return { ok: false, missing: gaps };
  const demand: ApprovedDemand = {
    projectId: d.projectId!.value,
    role: d.role!.value,
    level: d.level!.value,
    skills: d.skills?.value ?? [],
    hoursPerWeek: d.hoursPerWeek!.value,
    startWeek: d.startWeek!.value,
    endWeek: d.endWeek!.value,
  };
  if (demand.endWeek < demand.startWeek) return { ok: false, missing: [], problem: "end_before_start" };
  if (!Number.isInteger(demand.hoursPerWeek) || demand.hoursPerWeek < 1 || demand.hoursPerWeek > 40) return { ok: false, missing: [], problem: "hours_out_of_range" };
  return { ok: true, demand };
}
