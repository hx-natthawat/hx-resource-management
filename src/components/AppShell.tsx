"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { IconAlert, IconCheck, IconGrid, IconHome, IconList, IconMic, IconPlus } from "./icons";

export interface ShellCounts {
  drafts: number;
  requests: number;
  conflicts: number;
}

interface ShellProps {
  userName: string;
  roleLabel: string;
  counts: ShellCounts;
  devLogin: boolean;
  children: ReactNode;
}

const NAV = [
  { href: "/", label: "หน้าหลัก", icon: IconHome },
  { href: "/voice", label: "สั่งด้วยเสียง", icon: IconMic },
  { href: "/review", label: "รอตรวจ", icon: IconCheck, badge: "drafts" as const },
  { href: "/approve", label: "อนุมัติ Booking", icon: IconCheck, badge: "requests" as const },
  { href: "/capacity", label: "Capacity", icon: IconGrid },
  { href: "/conflicts", label: "Conflict", icon: IconAlert, badge: "conflicts" as const },
  { href: "/portfolio", label: "Portfolio Rank", icon: IconList },
  { href: "/demand", label: "ส่ง Demand ด้วยฟอร์ม", icon: IconPlus },
];

const ToastCtx = createContext<(message: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function AppShell({ userName, roleLabel, counts, devLogin, children }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const show = useCallback((m: string) => setToast(m), []);
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const signOut = async () => {
    await fetch("/api/dev/sign-out", { method: "POST" });
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <ToastCtx.Provider value={show}>
      <div className="min-h-dvh lg:flex">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-[rgba(52,85,137,0.08)] bg-white px-4 py-6 lg:flex">
          <Brand />
          <nav aria-label="เมนูหลัก" className="flex flex-col gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`flex min-h-[44px] items-center gap-2.5 rounded-xl px-3.5 font-medium ${active(n.href) ? "bg-hx-blue text-white" : "text-hx-ink hover:bg-hx-tint-2 hover:text-hx-blue"}`}
              >
                <n.icon size={18} />
                <span className="flex-1">{n.label}</span>
                {n.badge && counts[n.badge] > 0 && (
                  <span className={`pill ${n.badge === "conflicts" ? "bg-hx-over text-white" : "bg-hx-gold text-white"}`}>{counts[n.badge]}</span>
                )}
              </Link>
            ))}
          </nav>
          <UserCard name={userName} roleLabel={roleLabel} devLogin={devLogin} onSignOut={signOut} />
        </aside>

        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 px-4 pt-4 lg:hidden">
            <Brand compact />
            <button type="button" onClick={signOut} className="min-h-[40px] rounded-full bg-hx-tint-2 px-3.5 text-[13px] font-semibold text-hx-blue" aria-label={`ออกจากระบบ ${userName}`}>
              {roleLabel}
            </button>
          </header>
          <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-48 pt-4 lg:px-10 lg:pb-12 lg:pt-8">{children}</main>
        </div>

        <nav aria-label="เมนูหลัก" className="fixed inset-x-0 bottom-0 z-20 flex h-[76px] items-center justify-around border-t border-[rgba(52,85,137,0.08)] bg-white px-2 pb-[max(10px,env(safe-area-inset-bottom))] lg:hidden">
          <Tab href="/" label="หน้าหลัก" on={active("/")} icon={<IconHome size={22} />} />
          <Tab href="/capacity" label="Capacity" on={active("/capacity")} icon={<IconGrid size={22} />} />
          <Link href="/voice" aria-label="พูดสั่งงาน" className="-mt-7 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-hx-gold text-white shadow-[0_0_0_6px_var(--color-hx-tint),0_8px_20px_rgba(186,150,69,0.4)]">
            <IconMic size={26} />
          </Link>
          <Tab href="/approve" label="อนุมัติ" on={active("/approve") || active("/review")} icon={<IconCheck size={22} />} count={counts.drafts + counts.requests} />
          <Tab href="/portfolio" label="เพิ่มเติม" on={active("/portfolio") || active("/conflicts") || active("/demand")} icon={<IconList size={22} />} />
        </nav>

        {toast && (
          <div role="status" className="fixed inset-x-4 top-4 z-30 mx-auto max-w-md rounded-2xl bg-hx-ink px-4 py-3 text-center text-sm font-medium text-white lg:bottom-8 lg:top-auto">
            {toast}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2 no-underline">
      <span className="h-2.5 w-2.5 rounded-full bg-hx-gold" />
      <span className="flex flex-col leading-tight">
        <span className="text-lg font-extrabold tracking-[-0.02em] text-hx-blue">HarmonyX</span>
        {!compact && <span className="text-xs text-hx-muted">Resource Management</span>}
      </span>
    </Link>
  );
}

function Tab({ href, label, on, icon, count = 0 }: { href: string; label: string; on: boolean; icon: ReactNode; count?: number }) {
  return (
    <Link href={href} className={`relative flex min-h-[48px] min-w-[56px] flex-col items-center justify-center gap-0.5 text-[11px] ${on ? "font-bold text-hx-blue" : "text-hx-muted"}`}>
      {icon}
      {label}
      {count > 0 && <span className="absolute right-1 top-0 rounded-full bg-hx-gold px-1.5 text-[10px] font-bold text-white">{count}</span>}
    </Link>
  );
}

function UserCard({ name, roleLabel, devLogin, onSignOut }: { name: string; roleLabel: string; devLogin: boolean; onSignOut: () => void }) {
  return (
    <div className="mt-auto flex flex-col gap-2 rounded-xl bg-hx-tint-2 p-3 text-sm">
      <div>
        <div className="font-semibold text-hx-blue">{name}</div>
        <div className="text-xs text-hx-muted">{roleLabel}</div>
      </div>
      <button type="button" onClick={onSignOut} className="min-h-[40px] rounded-full border border-[rgba(52,85,137,0.2)] bg-white text-[13px] font-semibold text-hx-blue">
        {devLogin ? "เปลี่ยนผู้ใช้ (demo)" : "ออกจากระบบ"}
      </button>
    </div>
  );
}
