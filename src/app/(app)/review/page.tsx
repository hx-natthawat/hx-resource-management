import { redirect } from "next/navigation";
import type { Booking } from "@/modules/booking";
import { rankCandidates } from "@/modules/conflict";
import { draftToDemand, inferredCount, missing } from "@/modules/integration";
import { can, formatWeekRange, LEVELS, mondayOf, ROLES } from "@/modules/people";
import { loadSnapshot } from "@/server/data";
import { withPage } from "@/server/page";
import { openDrafts } from "@/server/voice/drafts";
import { DraftReview, type ReviewDraft } from "./DraftReview";

export const dynamic = "force-dynamic";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const data = await withPage(async ({ db, user }) => {
    if (!can(user.role, "draft.create")) return null;
    const s = await loadSnapshot(db, user.tenantId);
    const drafts: ReviewDraft[] = (await openDrafts(db, user)).map((d) => {
      const check = draftToDemand(d);
      const fits = check.ok
        ? rankCandidates({ id: "probe", ...check.demand, personId: null, status: "Requested", requestedBy: "", source: "voice" } satisfies Booking, s.people, s.bookings, s.capacityOf).filter((c) => c.fits).length
        : null;
      return {
        draft: d,
        missing: missing(d),
        problem: check.ok ? null : (check.problem ?? null),
        fits,
        inferred: inferredCount(d),
        period: d.startWeek && d.endWeek ? formatWeekRange(d.startWeek.value, d.endWeek.value) : null,
        startDate: d.startWeek ? iso(mondayOf(d.startWeek.value)) : "",
        endDate: d.endWeek ? iso(new Date(mondayOf(d.endWeek.value).getTime() + 4 * 86_400_000)) : "",
      };
    });
    return { drafts, projects: s.projects.filter((p) => p.status !== "Closed").map((p) => ({ id: p.id, name: p.name, rank: p.rank })) };
  });
  if (!data) redirect("/");
  return <DraftReview drafts={data.drafts} selectedId={id} projects={data.projects} roles={[...ROLES]} levels={[...LEVELS]} />;
}
