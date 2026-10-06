import { and, asc, eq, inArray } from "drizzle-orm";
import { findConflicts, planDecision, type DecisionChoice, type DecisionError } from "@/modules/conflict";
import { capacityWithHolidays, weeksBetween } from "@/modules/people";
import type { Db } from "../db/client";
import { toBooking, toHoliday, toPerson, toProject } from "../db/mappers";
import { auditEvents, bookings, decisions, holidays, notifications, people, projects } from "../db/schema";

export interface DecideInput extends DecisionChoice {
  tenantId: string;
  actor: string;
  actorUserId?: string;
  personId: string;
  /** Client-generated; a retry with the same id returns the first result. */
  requestId: string;
}

export type DecideResult =
  | { ok: true; decision: typeof decisions.$inferSelect; replayed: boolean }
  | { ok: false; code: DecisionError | "not_found" | "no_conflict"; message: string; peakPercent?: number };

const KIND_TH = { shift: "เลื่อน", substitute: "เปลี่ยนคน", reduce: "ลดชั่วโมง" } as const;

/**
 * Resource Council decides one conflict (ADR-003, ADR-006). Inside one transaction the
 * people involved are locked, the conflict is recomputed from current rows (so a stale
 * screen cannot act on a conflict that is already gone), the plan is applied to one
 * booking, and one Decision log entry plus one audit event are written. The losing
 * project's PM gets an in-app notice.
 */
export async function decideConflict(db: Db, input: DecideInput): Promise<DecideResult> {
  return db.transaction(async (tx) => {
    const [seen] = await tx.select().from(decisions).where(and(eq(decisions.requestId, input.requestId), eq(decisions.tenantId, input.tenantId)));
    if (seen) return { ok: true, decision: seen, replayed: true };

    // Lock in id order so a concurrent confirm or decision on the same people serialises without deadlock.
    const lockIds = [...new Set([input.personId, input.substituteId].filter((x): x is string => !!x))];
    const locked = await tx
      .select()
      .from(people)
      .where(and(eq(people.tenantId, input.tenantId), inArray(people.id, lockIds)))
      .orderBy(asc(people.id))
      .for("update");
    const person = locked.find((p) => p.id === input.personId);
    if (!person) return { ok: false, code: "not_found", message: "Person not found" };
    if (input.substituteId && !locked.some((p) => p.id === input.substituteId)) return { ok: false, code: "substitute_unavailable", message: "Substitute not found" };

    const allPeople = (await tx.select().from(people).where(eq(people.tenantId, input.tenantId))).map(toPerson);
    const allProjects = (await tx.select().from(projects).where(eq(projects.tenantId, input.tenantId))).map(toProject);
    const rows = await tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.tenantId, input.tenantId), inArray(bookings.status, ["Proposed", "Confirmed"])));
    const active = rows.map(toBooking);
    const hols = (await tx.select().from(holidays).where(eq(holidays.tenantId, input.tenantId))).map(toHoliday);
    const capacityOf = capacityWithHolidays(hols);

    const target = active.find((b) => b.id === input.bookingId);
    const span = active.filter((b) => b.personId === input.personId);
    if (!target || span.length === 0) return { ok: false, code: "no_conflict", message: "Booking is no longer active for this person" };
    const weeks = weeksBetween(Math.min(...span.map((b) => b.startWeek)), Math.max(...span.map((b) => b.endWeek)));
    const conflict = findConflicts([toPerson(person)], active, weeks, capacityOf)[0];
    if (!conflict) return { ok: false, code: "no_conflict", message: "This conflict has already been resolved" };

    const plan = planDecision(conflict, input, { people: allPeople, projects: allProjects, bookings: active, capacityOf });
    if (!plan.ok) return { ok: false, code: plan.code, message: plan.code, peakPercent: plan.peakPercent };

    const before = rows.find((r) => r.id === target.id)!;
    const [updated] = await tx
      .update(bookings)
      .set({ personId: plan.change.personId, startWeek: plan.change.startWeek, endWeek: plan.change.endWeek, hoursPerWeek: plan.change.hoursPerWeek, updatedAt: new Date() })
      .where(eq(bookings.id, target.id))
      .returning();

    const project = allProjects.find((p) => p.id === target.projectId)!;
    const sub = allPeople.find((p) => p.id === input.substituteId);
    const detail =
      input.kind === "shift"
        ? `${project.name} ออกไป ${plan.shiftWeeks} สัปดาห์`
        : input.kind === "substitute"
          ? `${project.name} ให้ ${sub?.name} ทำแทน`
          : `${project.name} จาก ${target.hoursPerWeek} เหลือ ${plan.change.hoursPerWeek} ชม.`;
    const reason = plan.followedRecommendation ? "ตามกฎ Rank สูงกว่าได้ก่อน" : input.reason!.trim();

    const [decision] = await tx
      .insert(decisions)
      .values({
        tenantId: input.tenantId,
        personId: input.personId,
        bookingId: target.id,
        weeks: conflict.weeks,
        kind: input.kind,
        summary: `${person.name} · ${KIND_TH[input.kind]} ${detail}`,
        followedRecommendation: plan.followedRecommendation,
        reason,
        decidedBy: input.actor,
        requestId: input.requestId,
      })
      .returning();

    await tx.insert(auditEvents).values({
      tenantId: input.tenantId,
      actor: input.actor,
      entity: "booking",
      entityId: target.id,
      action: `decide.${input.kind}`,
      before: { personId: before.personId, startWeek: before.startWeek, endWeek: before.endWeek, hoursPerWeek: before.hoursPerWeek },
      after: { personId: updated.personId, startWeek: updated.startWeek, endWeek: updated.endWeek, hoursPerWeek: updated.hoursPerWeek, decisionId: decision.id },
    });

    const [owner] = await tx.select({ ownerUserId: projects.ownerUserId }).from(projects).where(eq(projects.id, project.id));
    if (owner?.ownerUserId && owner.ownerUserId !== input.actorUserId) {
      await tx.insert(notifications).values({
        tenantId: input.tenantId,
        userId: owner.ownerUserId,
        title: `Council ตัดสิน Conflict ของ ${project.name}`,
        body: `${decision.summary} · ${reason}`,
        href: "/conflicts",
      });
    }

    return { ok: true, decision, replayed: false };
  });
}
