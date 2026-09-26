import type { CycleTotals } from "@/domain/totals";
import { Money } from "../Money";
import { StatusBadge } from "../StatusBadge";

function Tile({ testId, title, children, footer, expected }: { testId: string; title: string; children: React.ReactNode; footer: React.ReactNode; expected?: boolean }) {
  return (
    <div
      data-testid={testId}
      className={`flex min-w-0 flex-col gap-1 rounded-2xl p-3 nav:p-4 ${expected ? "border-2 border-dashed border-teal/50 bg-card" : "border border-line bg-card"}`}
    >
      <p className="text-sm font-medium text-muted">{title}</p>
      <p className="truncate text-xl font-semibold nav:text-2xl">{children}</p>
      <div className="flex flex-wrap items-center gap-1.5">{footer}</div>
    </div>
  );
}

export function StatTiles({ totals }: { totals: CycleTotals }) {
  return (
    <div className="grid grid-cols-2 gap-2 nav:grid-cols-4 nav:gap-3">
      <Tile testId="stat-income" title="รับจริง" footer={<StatusBadge status="actual" />}>
        <Money minor={totals.actualIncomeMinor} label="รับจริง" className="text-sage" />
      </Tile>
      <Tile testId="stat-expense" title="จ่ายจริง" footer={<StatusBadge status="actual" />}>
        <Money minor={totals.actualExpenseMinor} label="จ่ายจริง" />
      </Tile>
      <Tile
        testId="stat-net"
        title="สุทธิรอบนี้"
        footer={
          <>
            <StatusBadge status="actual" />
            <span className="text-xs text-muted">ไม่ใช่ยอดในบัญชี</span>
          </>
        }
      >
        <Money minor={totals.netMinor} label="สุทธิรอบนี้" />
      </Tile>
      <Tile
        testId="stat-expected"
        title="จะตัดอีก"
        expected
        footer={
          <>
            <StatusBadge status="expected" />
            {totals.missingFxCount > 0 && <span className="text-xs text-muted">รออัตราแลกเปลี่ยน {totals.missingFxCount} รายการ</span>}
          </>
        }
      >
        <Money minor={totals.expectedExpenseMinor} label="จะตัดอีก คาดว่าจะเกิด" className="text-teal" />
      </Tile>
    </div>
  );
}
