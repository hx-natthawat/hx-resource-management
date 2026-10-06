import { findConflicts, fitShift, planDecision, recommendResolution, reducedHours, suggestSubstitute } from "@/modules/conflict";
import { can, formatWeekRange, weekLabel, weeksFrom } from "@/modules/people";
import { and, eq, isNull } from "drizzle-orm";
import { loadSnapshot, recentDecisions } from "@/server/data";
import { notifications } from "@/server/db/schema";
import { currentWeek, withPage } from "@/server/page";
import { ConflictBoard, type ConflictView, type LogEntry } from "./ConflictBoard";

export const dynamic = "force-dynamic";

export default async function ConflictsPage() {
  const data = await withPage(async ({ db, user }) => {
    const s = await loadSnapshot(db, user.tenantId);
    const conflicts = findConflicts(s.people, s.bookings, weeksFrom(currentWeek(), 8), s.capacityOf);
    const views: ConflictView[] = [];
    for (const c of conflicts) {
      const person = s.people.find((p) => p.id === c.personId)!;
      const rec = recommendResolution(c, s.bookings, s.projects);
      const involved = s.bookings
        .filter((b) => c.bookingIds.includes(b.id))
        .map((b) => {
          const project = s.projects.find((p) => p.id === b.projectId)!;
          const sub = suggestSubstitute(b, person.id, s.people, s.bookings, s.capacityOf);
          // Preview each option with the same rules the server applies, so the screen never offers a fix that will be refused.
          const works = (kind: "shift" | "reduce") => planDecision(c, { bookingId: b.id, kind, reason: "preview" }, { ...s, capacityOf: s.capacityOf }).ok;
          return {
            id: b.id,
            projectName: project.name,
            projectRank: project.rank,
            hoursPerWeek: b.hoursPerWeek,
            soft: b.status === "Proposed",
            period: formatWeekRange(b.startWeek, b.endWeek),
            shiftWeeks: fitShift(b, c, person, s.bookings, s.capacityOf),
            reducedHours: reducedHours(b.hoursPerWeek),
            shiftOk: works("shift"),
            reduceOk: works("reduce"),
            substitute: sub ? { personId: sub.person.id, name: sub.person.name, skillMatch: Math.round(sub.skillMatch * 100), peakAfter: sub.peakAfter } : null,
          };
        })
        .sort((a, b) => a.projectRank - b.projectRank);
      views.push({
        personId: person.id,
        name: person.name,
        role: person.role,
        isKeyResource: person.isKeyResource,
        wipLimit: person.wipLimit,
        peakPercent: c.peakPercent,
        weeks: c.weeks.map(weekLabel).join(", "),
        recommendedBookingId: rec?.bookingId ?? null,
        bookings: involved,
      });
    }
    const log: LogEntry[] = (await recentDecisions(db, user.tenantId, 20)).map((d) => ({
      id: d.id,
      kind: d.kind,
      summary: d.summary,
      followed: d.followedRecommendation,
      reason: d.reason,
      decidedBy: d.decidedBy,
      decidedAt: d.decidedAt.toISOString(),
    }));
    // Opening the conflict page counts as reading the Council notices that point here.
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.tenantId, user.tenantId), eq(notifications.userId, user.userId), eq(notifications.href, "/conflicts"), isNull(notifications.readAt)));
    return { views, log, canDecide: can(user.role, "conflict.decide") };
  });
  return <ConflictBoard conflicts={data.views} log={data.log} canDecide={data.canDecide} />;
}
