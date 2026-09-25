// P0 placeholder — the real ภาพรวม screen lands in P3 (docs/04-build-plan.md).
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-4 px-4 py-8">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 place-items-center rounded-xl bg-teal text-sm font-semibold text-white"
        >
          เห็น
        </span>
        <h1 className="text-2xl font-semibold">เห็นเงิน</h1>
      </div>
      <p className="text-muted">เห็นเงินเข้า เงินออก และวันตัดในก้อนเดียว</p>
      <p className="text-sm text-muted">ใช้ฟรีในเครื่องนี้ · ไม่เชื่อมบัญชีธนาคาร</p>
    </main>
  );
}
