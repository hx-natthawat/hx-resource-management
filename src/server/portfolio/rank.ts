import { and, eq, ne } from "drizzle-orm";
import { deviationsFromWsjf, rankMoves, validateOrder, type OrderError } from "@/modules/portfolio";
import type { Db } from "../db/client";
import { toProject } from "../db/mappers";
import { auditEvents, decisions, projects } from "../db/schema";

export interface SaveRankInput {
  tenantId: string;
  actor: string;
  order: string[];
  reason?: string;
}

export type SaveRankResult =
  | { ok: true; changed: number; deviations: string[] }
  | { ok: false; code: OrderError | "reason_required"; message: string; deviations?: string[] };

/**
 * Executive publishes the Portfolio Rank (ADR-003). The order is the rank, so ties cannot be
 * saved. Ordering against WSJF needs a reason. One Decision log entry per save; one audit event
 * per project that moved. Saving the same order again changes nothing.
 */
export async function saveRank(db: Db, input: SaveRankInput): Promise<SaveRankResult> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(projects)
      .where(and(eq(projects.tenantId, input.tenantId), ne(projects.status, "Closed")))
      .orderBy(projects.rank)
      .for("update");
    const current = rows.map(toProject);

    const invalid = validateOrder(current.map((p) => p.id), input.order);
    if (invalid) return { ok: false, code: invalid, message: `Order is ${invalid}` };

    const deviations = deviationsFromWsjf(current, input.order);
    const reason = input.reason?.trim() ?? "";
    if (deviations.length > 0 && reason.length < 5) {
      return { ok: false, code: "reason_required", message: "Order differs from WSJF; a reason is required", deviations };
    }

    const moves = rankMoves(current, input.order);
    if (moves.length === 0) return { ok: true, changed: 0, deviations };

    for (const m of moves) {
      await tx.update(projects).set({ rank: m.to }).where(eq(projects.id, m.projectId));
      await tx.insert(auditEvents).values({
        tenantId: input.tenantId,
        actor: input.actor,
        entity: "project",
        entityId: m.projectId,
        action: "rank",
        before: { rank: m.from },
        after: { rank: m.to },
      });
    }

    // Closed projects keep their relative order behind every rankable one, so ranks stay unique.
    const closed = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.tenantId, input.tenantId), eq(projects.status, "Closed")))
      .orderBy(projects.rank);
    for (const [i, c] of closed.entries()) {
      await tx.update(projects).set({ rank: input.order.length + i + 1 }).where(eq(projects.id, c.id));
    }

    const name = (id: string) => current.find((p) => p.id === id)!.name;
    await tx.insert(decisions).values({
      tenantId: input.tenantId,
      kind: "rank",
      summary: moves.map((m) => `${name(m.projectId)} ${m.from} → ${m.to}`).join(" · "),
      followedRecommendation: deviations.length === 0,
      reason: deviations.length === 0 ? "ตามลำดับ WSJF" : reason,
      decidedBy: input.actor,
    });

    return { ok: true, changed: moves.length, deviations };
  });
}
