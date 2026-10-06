"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DevSignIn({ users }: { users: { id: string; name: string; roleLabel: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const signIn = async (userId: string) => {
    setBusy(userId);
    const res = await fetch("/api/dev/sign-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }) });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else setBusy(null);
  };
  return (
    <ul className="flex flex-col gap-2">
      {users.map((u) => (
        <li key={u.id}>
          <button type="button" disabled={busy !== null} onClick={() => signIn(u.id)} className="flex min-h-[56px] w-full items-center justify-between rounded-[14px] border border-[rgba(52,85,137,0.12)] bg-white px-4 text-left hover:bg-hx-tint-2 disabled:opacity-60">
            <span className="font-semibold">{u.name}</span>
            <span className="pill bg-hx-tint-2 text-hx-blue">{u.roleLabel}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
