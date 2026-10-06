import { and, desc, eq } from "drizzle-orm";
import { applyEdits, draftToDemand, extract, missing, nextQuestion, type DemandDraft, type DraftEdits, type Extractor } from "@/modules/integration";
import type { Db } from "../db/client";
import { toProject } from "../db/mappers";
import { auditEvents, drafts, projects } from "../db/schema";
import { insertDemand, type Tx } from "../booking/commands";

export interface DraftOwner {
  tenantId: string;
  userId: string;
  name: string;
}

export type DraftResult =
  | { ok: true; draft: DemandDraft; missing: string[]; question: string | null }
  | { ok: false; code: "not_found" | "invalid_state"; message: string };

const view = (draft: DemandDraft): DraftResult => ({ ok: true, draft, missing: missing(draft), question: nextQuestion(draft) });

/** Only the owner's open draft can be read or changed. Locked so two utterances on one draft apply in order. */
async function lockOpen(tx: Tx, owner: DraftOwner, draftId: string) {
  const [row] = await tx
    .select()
    .from(drafts)
    .where(and(eq(drafts.id, draftId), eq(drafts.tenantId, owner.tenantId), eq(drafts.userId, owner.userId)))
    .for("update");
  return row;
}

/**
 * One utterance (from speech or typed) fills fields on a new or existing draft (ADR-008).
 * The extractor is swappable; today it is the rule-based Thai extractor.
 */
export async function say(db: Db, owner: DraftOwner, input: { draftId?: string; text: string; today: Date }, extractor: Extractor = extract): Promise<DraftResult> {
  return db.transaction(async (tx) => {
    const ps = (await tx.select().from(projects).where(eq(projects.tenantId, owner.tenantId))).map(toProject).filter((p) => p.status !== "Closed");
    const id = input.draftId ?? crypto.randomUUID();
    const ctx = { projects: ps, requestedBy: owner.name, year: input.today.getUTCFullYear(), today: input.today, newId: () => id };
    if (input.draftId) {
      const row = await lockOpen(tx, owner, input.draftId);
      if (!row) return { ok: false, code: "not_found", message: "Draft not found" };
      if (row.status !== "open") return { ok: false, code: "invalid_state", message: `Draft is ${row.status}` };
      const next = extractor(input.text, ctx, row.data as DemandDraft);
      await tx.update(drafts).set({ data: next, updatedAt: new Date() }).where(eq(drafts.id, row.id));
      return view(next);
    }
    const draft = extractor(input.text, ctx);
    await tx.insert(drafts).values({ id, tenantId: owner.tenantId, userId: owner.userId, data: { ...draft, id } });
    return view({ ...draft, id });
  });
}

export async function editDraft(db: Db, owner: DraftOwner, draftId: string, edits: DraftEdits): Promise<DraftResult> {
  return db.transaction(async (tx) => {
    const row = await lockOpen(tx, owner, draftId);
    if (!row) return { ok: false, code: "not_found", message: "Draft not found" };
    if (row.status !== "open") return { ok: false, code: "invalid_state", message: `Draft is ${row.status}` };
    if (edits.projectId) {
      const [p] = await tx.select({ id: projects.id }).from(projects).where(and(eq(projects.id, edits.projectId), eq(projects.tenantId, owner.tenantId)));
      if (!p) return { ok: false, code: "not_found", message: "Project not found" };
    }
    const next = applyEdits(row.data as DemandDraft, edits);
    await tx.update(drafts).set({ data: next, updatedAt: new Date() }).where(eq(drafts.id, row.id));
    return view(next);
  });
}

export type ApproveResult =
  | { ok: true; bookingId: string; alreadyApproved: boolean }
  | { ok: false; code: "not_found" | "invalid_state" | "incomplete"; message: string; missing?: string[] };

/**
 * The human approval step (ADR-008). Only now does the draft become a Requested booking,
 * in the same transaction that closes the draft, so a double tap creates one booking.
 */
export async function approveDraft(db: Db, owner: DraftOwner, draftId: string): Promise<ApproveResult> {
  return db.transaction(async (tx) => {
    const row = await lockOpen(tx, owner, draftId);
    if (!row) return { ok: false, code: "not_found", message: "Draft not found" };
    if (row.status === "approved" && row.bookingId) return { ok: true, bookingId: row.bookingId, alreadyApproved: true };
    if (row.status !== "open") return { ok: false, code: "invalid_state", message: `Draft is ${row.status}` };
    const check = draftToDemand(row.data as DemandDraft);
    if (!check.ok) return { ok: false, code: "incomplete", message: check.problem ?? "Draft is missing fields", missing: check.missing };
    const transcript = (row.data as DemandDraft).transcript.join(" / ");
    const created = await insertDemand(tx, { ...check.demand, tenantId: owner.tenantId, actor: owner.name, source: "voice", note: transcript.slice(0, 1000) });
    if (!created.ok) return { ok: false, code: created.code === "not_found" ? "not_found" : "invalid_state", message: created.message };
    await tx.update(drafts).set({ status: "approved", bookingId: created.value.id, updatedAt: new Date() }).where(eq(drafts.id, row.id));
    await tx.insert(auditEvents).values({ tenantId: owner.tenantId, actor: owner.name, entity: "draft", entityId: row.id, action: "approve", before: { status: "open" }, after: { status: "approved", bookingId: created.value.id } });
    return { ok: true, bookingId: created.value.id, alreadyApproved: false };
  });
}

export async function discardDraft(db: Db, owner: DraftOwner, draftId: string): Promise<{ ok: boolean }> {
  return db.transaction(async (tx) => {
    const row = await lockOpen(tx, owner, draftId);
    if (!row || row.status === "approved") return { ok: false };
    if (row.status === "open") await tx.update(drafts).set({ status: "discarded", updatedAt: new Date() }).where(eq(drafts.id, row.id));
    return { ok: true };
  });
}

export async function openDrafts(db: Db, owner: Pick<DraftOwner, "tenantId" | "userId">): Promise<DemandDraft[]> {
  const rows = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.tenantId, owner.tenantId), eq(drafts.userId, owner.userId), eq(drafts.status, "open")))
    .orderBy(desc(drafts.updatedAt));
  return rows.map((r) => r.data as DemandDraft);
}
