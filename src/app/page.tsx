const R1 = [
  { title: "สั่งงานด้วยเสียง", note: "ADR-008" },
  { title: "ตรวจและอนุมัติ", note: "ADR-002" },
  { title: "Capacity heatmap", note: "ADR-004" },
  { title: "Demand และ Booking", note: "ADR-002 · ADR-006" },
  { title: "Conflict engine", note: "ADR-003 · ADR-006" },
  { title: "Portfolio Rank", note: "ADR-003" },
  { title: "SSO และ audit log", note: "ADR-005 · ADR-006" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 py-6 lg:py-12">
      <header className="flex items-center gap-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-hx-gold" />
        <span className="flex flex-col leading-tight">
          <span className="text-lg font-extrabold tracking-[-0.02em] text-hx-blue">HarmonyX</span>
          <span className="text-xs text-hx-muted">Resource Management</span>
        </span>
      </header>
      <section className="flex flex-col gap-1">
        <span className="eyebrow">Release 1 · กำลังพัฒนา</span>
        <h1 className="h1">โครงระบบพร้อมแล้ว ฟีเจอร์จะทยอยเปิดตามลำดับบนบอร์ด</h1>
        <p className="text-sm text-hx-muted">หน้าจอทั้งหมดอ้างอิงจาก prototype ที่ได้รับการยืนยัน ที่ prototypes/ui-mobile-first</p>
      </section>
      <ul className="flex flex-col gap-2">
        {R1.map((f) => (
          <li key={f.title} className="flex min-h-[56px] items-center justify-between gap-3 rounded-[14px] border border-[rgba(52,85,137,0.08)] bg-white px-4 py-3">
            <span className="font-semibold">{f.title}</span>
            <span className="pill bg-hx-tint-2 text-hx-blue">{f.note}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
