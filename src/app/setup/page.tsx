export default function SetupPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-10">
      <h1 className="h1">ยังไม่ได้ตั้งค่าฐานข้อมูล</h1>
      <p className="text-sm text-hx-muted">เปิด Terminal อีกหน้าต่างแล้วรัน <code>pnpm dev:db</code> จากนั้นรีสตาร์ท <code>pnpm dev</code></p>
    </main>
  );
}
