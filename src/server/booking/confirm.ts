import { and, eq, inArray, ne } from "drizzle-orm";
import { transition, type Booking } from "@/modules/booking";
import { loadAfter } from "@/modules/conflict";
import type { Person } from "@/modules/people";
import type { Db } from "../db/client";
import { auditEvents, bookings, people } from "../db/schema";

export type ConfirmResult =
  | { ok: true; booking: typeof bookings.$inferSelect; alreadyConfirmed: boolean }
  | { ok: false; code: "not_found" | "invalid_state" | "over_capacity"; message: string; peakPercent?: number };

export interface ConfirmInput {
  tenantId: string;
  bookingId: string;
  personId: string;
  actor: string;
}

const toDomainPerson = (p: typeof people.$inferSelect): Person => ({
  id: p.id,
  name: p.name,
  role: p.role as Person["role"],
  company: p.company as Person["company"],
  level: p.level as Person["level"],
  skills: p.skills,
  capacityHours: p.capacityHours,
  isKeyResource: p.isKeyResource,
  wipLimit: p.wipLimit,
});

const toDomainBooking = (b: typeof bookings.$inferSelect): Booking => ({
  id: b.id,
  projectId: b.projectId,
  role: b.role as Booking["role"],
  skills: b.skills,
  level: b.level as Booking["level"],
  personId: b.personId,
  hoursPerWeek: b.hoursPerWeek,
  startWeek: b.startWeek,
  endWeek: b.endWeek,
  status: b.status,
  requestedBy: b.requestedBy,
  note: b.note ?? undefined,
  source: b.source,
});

/**
 * Resource Manager confirms a booking for a person (ADR-002, ADR-006).
 * The person's row is locked for the whole transaction, so two confirmations for
 * the same person serialise and the second one sees the first one's hours.
 * Confirming an already confirmed booking for the same person converges (idempotent).
 */
export async function confirmBooking(db: Db, input: ConfirmInput): Promise<ConfirmResult> {
  return db.transaction(async (tx) => {
    const [person] = await tx
      .select()
      .from(people)
      .where(and(eq(people.id, input.personId), eq(people.tenantId, input.tenantId)))
      .for("update");
    if (!person) return { ok: false, code: "not_found", message: "Person not found" };

    const [row] = await tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, input.bookingId), eq(bookings.tenantId, input.tenantId)))
      .for("update");
    if (!row) return { ok: false, code: "not_found", message: "Booking not found" };

    if (row.status === "Confirmed" && row.personId === input.personId) {
      return { ok: true, booking: row, alreadyConfirmed: true };
    }

    const others = await tx
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.tenantId, input.tenantId),
          eq(bookings.personId, input.personId),
          ne(bookings.id, row.id),
          inArray(bookings.status, ["Proposed", "Confirmed"]),
        ),
      );

    const domainPerson = toDomainPerson(person);
    const peak = loadAfter(domainPerson, others.map(toDomainBooking), row);
    if (peak > 100) {
      return { ok: false, code: "over_capacity", message: `${person.name} would reach ${peak}%`, peakPercent: peak };
    }

    const proposed = row.status === "Proposed" && row.personId === input.personId
      ? { ok: true as const, booking: toDomainBooking(row) }
      : transition(toDomainBooking(row), { type: "propose", personId: input.personId });
    if (!proposed.ok) return { ok: false, code: "invalid_state", message: proposed.error };
    const confirmed = transition(proposed.booking, { type: "confirm" });
    if (!confirmed.ok) return { ok: false, code: "invalid_state", message: confirmed.error };

    const [updated] = await tx
      .update(bookings)
      .set({ status: "Confirmed", personId: input.personId, updatedAt: new Date() })
      .where(eq(bookings.id, row.id))
      .returning();

    await tx.insert(auditEvents).values({
      tenantId: input.tenantId,
      actor: input.actor,
      entity: "booking",
      entityId: row.id,
      action: "confirm",
      before: { status: row.status, personId: row.personId },
      after: { status: updated.status, personId: updated.personId },
    });

    return { ok: true, booking: updated, alreadyConfirmed: false };
  });
}
