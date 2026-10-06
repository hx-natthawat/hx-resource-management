import { and, eq } from "drizzle-orm";
import { transition, type BookingEvent } from "@/modules/booking";
import type { Level, Role, Week } from "@/modules/people";
import type { Db } from "../db/client";
import { toBooking } from "../db/mappers";
import { auditEvents, bookings, people, projects } from "../db/schema";

export interface DemandInput {
  tenantId: string;
  actor: string;
  projectId: string;
  role: Role;
  level: Level;
  skills: string[];
  hoursPerWeek: number;
  startWeek: Week;
  endWeek: Week;
  note?: string;
  source: "voice" | "form";
}

export type CommandResult<T> = { ok: true; value: T } | { ok: false; code: "not_found" | "invalid_state" | "invalid_request"; message: string };

/**
 * PM raises a demand by role and skill (ADR-002). It enters as Requested with no person,
 * so it consumes no capacity until a Resource Manager confirms someone.
 */
export async function createDemand(db: Db, input: DemandInput): Promise<CommandResult<typeof bookings.$inferSelect>> {
  if (input.endWeek < input.startWeek) return { ok: false, code: "invalid_request", message: "End is before start" };
  return db.transaction(async (tx) => {
    const [project] = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, input.projectId), eq(projects.tenantId, input.tenantId)));
    if (!project) return { ok: false, code: "not_found", message: "Project not found" };
    const [row] = await tx
      .insert(bookings)
      .values({
        tenantId: input.tenantId,
        projectId: input.projectId,
        personId: null,
        role: input.role,
        level: input.level,
        skills: input.skills,
        hoursPerWeek: input.hoursPerWeek,
        startWeek: input.startWeek,
        endWeek: input.endWeek,
        status: "Requested",
        requestedBy: input.actor,
        note: input.note ?? null,
        source: input.source,
      })
      .returning();
    await tx.insert(auditEvents).values({ tenantId: input.tenantId, actor: input.actor, entity: "booking", entityId: row.id, action: "request", before: null, after: { status: "Requested" } });
    return { ok: true, value: row };
  });
}

async function applyEvent(db: Db, tenantId: string, bookingId: string, actor: string, event: BookingEvent, action: string): Promise<CommandResult<typeof bookings.$inferSelect>> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.tenantId, tenantId)))
      .for("update");
    if (!row) return { ok: false, code: "not_found", message: "Booking not found" };
    if (event.type === "propose") {
      const [person] = await tx.select({ id: people.id }).from(people).where(and(eq(people.id, event.personId), eq(people.tenantId, tenantId)));
      if (!person) return { ok: false, code: "not_found", message: "Person not found" };
      if (row.status === "Proposed" && row.personId === event.personId) return { ok: true, value: row };
    }
    if (event.type === "reject" && row.status === "Rejected") return { ok: true, value: row };

    const next = transition(toBooking(row), event);
    if (!next.ok) return { ok: false, code: "invalid_state", message: next.error };
    const [updated] = await tx
      .update(bookings)
      .set({ status: next.booking.status, personId: next.booking.personId, updatedAt: new Date() })
      .where(eq(bookings.id, row.id))
      .returning();
    await tx.insert(auditEvents).values({
      tenantId,
      actor,
      entity: "booking",
      entityId: row.id,
      action,
      before: { status: row.status, personId: row.personId },
      after: { status: updated.status, personId: updated.personId },
    });
    return { ok: true, value: updated };
  });
}

/** RM proposes a named person (Soft). It shows on the heatmap but consumes no capacity. Idempotent. */
export const proposeBooking = (db: Db, tenantId: string, bookingId: string, personId: string, actor: string) =>
  applyEvent(db, tenantId, bookingId, actor, { type: "propose", personId }, "propose");

/** RM declines a request. Idempotent. */
export const rejectBooking = (db: Db, tenantId: string, bookingId: string, actor: string) => applyEvent(db, tenantId, bookingId, actor, { type: "reject" }, "reject");
