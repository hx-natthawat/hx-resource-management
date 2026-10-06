import { weekLoad } from "@/modules/conflict";
import { addWeeks, formatWeekRange, holidaysInWeek, weekLabel, weeksFrom, type Week } from "@/modules/people";
import { loadSnapshot } from "@/server/data";
import { currentWeek, withPage } from "@/server/page";
import { CapacityBoard, type HeatRow, type WeekHead } from "./CapacityBoard";

export const dynamic = "force-dynamic";

const SPAN = 8;

export default async function CapacityPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const now = currentWeek();
  const asked = Number((await searchParams).from);
  // Weeks are YYYYWW; anything else falls back to this week.
  const from: Week = Number.isInteger(asked) && asked % 100 >= 1 && asked % 100 <= 53 && asked > 200000 && asked < 300000 ? asked : now;
  const weeks = weeksFrom(from, SPAN);

  const { rows, heads } = await withPage(async ({ db, user }) => {
    const s = await loadSnapshot(db, user.tenantId);
    const heads: WeekHead[] = weeks.map((w) => ({ week: w, label: weekLabel(w), current: w === now, holidays: holidaysInWeek(s.holidays, w).map((h) => h.name) }));
    const rows: HeatRow[] = s.people.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      company: p.company,
      isKeyResource: p.isKeyResource,
      loads: weeks.map((w) => {
        const l = weekLoad(p, s.bookings, w, s.capacityOf);
        return { week: w, percent: l.percent, hardPercent: l.hardPercent, hasSoft: l.hasSoft, capacityHours: l.capacityHours, hardHours: l.hardHours, softHours: l.softHours };
      }),
      bookings: s.bookings
        .filter((b) => b.personId === p.id && (b.status === "Proposed" || b.status === "Confirmed") && b.endWeek >= weeks[0] && b.startWeek <= weeks[SPAN - 1])
        .map((b) => {
          const project = s.projects.find((x) => x.id === b.projectId)!;
          return { id: b.id, projectName: project.name, projectRank: project.rank, hoursPerWeek: b.hoursPerWeek, status: b.status, period: `${weekLabel(b.startWeek)} ถึง ${weekLabel(b.endWeek)}` };
        })
        .sort((a, b) => a.projectRank - b.projectRank),
    }));
    return { rows, heads };
  });

  return <CapacityBoard rows={rows} heads={heads} prev={addWeeks(from, -SPAN)} next={addWeeks(from, SPAN)} isNow={from === now} range={formatWeekRange(weeks[0], weeks[SPAN - 1])} />;
}
