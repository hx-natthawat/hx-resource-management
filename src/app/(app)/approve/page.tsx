import { loadAfter, rankCandidates } from "@/modules/conflict";
import { can, formatWeekRange } from "@/modules/people";
import { loadSnapshot } from "@/server/data";
import { withPage } from "@/server/page";
import { ApproveQueue, type QueueItem } from "./ApproveQueue";

export const dynamic = "force-dynamic";

export default async function ApprovePage() {
  const { items, canAct } = await withPage(async ({ db, user }) => {
    const s = await loadSnapshot(db, user.tenantId);
    const rank = (id: string) => s.projects.find((p) => p.id === id)?.rank ?? 999;
    const queue = s.bookings
      .filter((b) => b.status === "Requested" || b.status === "Proposed")
      .sort((a, b) => rank(a.projectId) - rank(b.projectId));
    const items: QueueItem[] = queue.map((b) => {
      const project = s.projects.find((p) => p.id === b.projectId)!;
      const others = s.bookings.filter((x) => x.id !== b.id);
      const candidates = rankCandidates(b, s.people, s.bookings, s.capacityOf)
        .slice(0, 5)
        .map((c) => ({
          personId: c.person.id,
          name: c.person.name,
          level: c.person.level,
          skills: c.person.skills,
          isKeyResource: c.person.isKeyResource,
          skillMatch: Math.round(c.skillMatch * 100),
          peakAfter: c.peakAfter,
          peakAfterHard: loadAfter(c.person, others, b, { count: "hard", capacityOf: s.capacityOf }),
          fits: c.fits,
          overWip: c.overWip,
        }));
      const proposed = b.personId ? s.people.find((p) => p.id === b.personId) : undefined;
      if (proposed && !candidates.some((c) => c.personId === proposed.id)) {
        candidates.unshift({
          personId: proposed.id,
          name: proposed.name,
          level: proposed.level,
          skills: proposed.skills,
          isKeyResource: proposed.isKeyResource,
          skillMatch: 0,
          peakAfter: loadAfter(proposed, others, b, { capacityOf: s.capacityOf }),
          peakAfterHard: loadAfter(proposed, others, b, { count: "hard", capacityOf: s.capacityOf }),
          fits: false,
          overWip: false,
        });
      }
      return {
        id: b.id,
        status: b.status,
        role: b.role,
        level: b.level,
        skills: b.skills,
        hoursPerWeek: b.hoursPerWeek,
        period: formatWeekRange(b.startWeek, b.endWeek),
        projectName: project.name,
        projectRank: project.rank,
        requestedBy: b.requestedBy,
        source: b.source,
        note: b.note,
        proposedPersonId: b.personId,
        candidates,
      };
    });
    return { items, canAct: can(user.role, "booking.confirm") };
  });
  return <ApproveQueue items={items} canAct={canAct} />;
}
