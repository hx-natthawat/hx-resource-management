import { AppShell } from "@/components/AppShell";
import { findConflicts } from "@/modules/conflict";
import { ROLE_LABEL, weeksFrom } from "@/modules/people";
import { loadSnapshot } from "@/server/data";
import { devLoginEnabled } from "@/server/env";
import { currentWeek, withPage } from "@/server/page";
import { openDrafts } from "@/server/voice/drafts";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, counts } = await withPage(async ({ db, user }) => {
    const s = await loadSnapshot(db, user.tenantId);
    return {
      user,
      counts: {
        drafts: (await openDrafts(db, user)).length,
        requests: s.bookings.filter((b) => b.status === "Requested").length,
        conflicts: findConflicts(s.people, s.bookings, weeksFrom(currentWeek(), 8), s.capacityOf).length,
      },
    };
  });
  return (
    <AppShell userName={user.name} roleLabel={ROLE_LABEL[user.role]} counts={counts} devLogin={devLoginEnabled()}>
      {children}
    </AppShell>
  );
}
