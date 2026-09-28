import { categoryName } from "@/domain/categories";
import { actualVsExpectedDiffMinor } from "@/domain/matching";
import { formatMoney, formatSignedThb, txThbMinor } from "@/domain/money";
import type { Account, AppState, Transaction } from "@/domain/types";
import { KIND_LABEL } from "@/lib/copy";
import { CategoryIcon } from "../CategoryIcon";
import { spokenMoney } from "../Money";

const accountLabel = (a: Account | undefined) => (a ? `${a.name}${a.last4 ? ` ••${a.last4}` : ""}` : "ไม่ระบุบัญชี");

const SIGN = { income: "+", refund: "+", expense: "−", transfer: "⇄" } as const;
const TONE = { income: "text-sage", refund: "text-sage", expense: "text-ink", transfer: "text-muted" } as const;

export function TransactionRow({ tx, state, onOpen }: { tx: Transaction; state: AppState; onOpen: () => void }) {
  const account = (id?: string) => state.accounts.find((a) => a.id === id);
  const thb = txThbMinor(tx);
  const rule = tx.recurringRuleId ? state.rules.find((r) => r.id === tx.recurringRuleId) : undefined;
  const diff = rule ? actualVsExpectedDiffMinor(rule, tx, state.settings) : null;
  const where =
    tx.kind === "transfer" ? `${accountLabel(account(tx.fromAccountId))} → ${accountLabel(account(tx.toAccountId))}` : accountLabel(account(tx.accountId));
  const what = tx.kind === "transfer" ? "โอน" : tx.kind === "refund" ? `คืนเงิน · ${categoryName(tx.categoryId)}` : categoryName(tx.categoryId);

  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper/60">
      <CategoryIcon kind={tx.kind} categoryId={tx.categoryId} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-medium">{tx.name}</span>
          {tx.recurringRuleId && <span className="shrink-0 rounded-full bg-teal-soft px-1.5 text-xs text-teal">ซ้ำ</span>}
          {tx.scope === "work" && <span className="shrink-0 rounded-full bg-navy px-1.5 text-xs text-white">งาน</span>}
        </span>
        <span className="block truncate text-sm text-muted">
          {what} · {where}
        </span>
        {diff !== null && diff !== 0 && <span className="block text-xs text-amber-ink">ต่างจากที่คาด {formatSignedThb(diff)}</span>}
      </span>
      <span className="shrink-0 text-right">
        <span data-testid="tx-amount" data-kind={tx.kind} className={`block font-semibold tabular-nums ${TONE[tx.kind]}`} aria-label={`${KIND_LABEL[tx.kind]} ${spokenMoney(thb)}`}>
          {SIGN[tx.kind]}
          {formatMoney(thb, "THB")}
        </span>
        {tx.currency !== "THB" && (
          <span className="block text-xs text-muted tabular-nums">
            {formatMoney(tx.amountMinor, tx.currency)} ≈ {formatMoney(thb, "THB")} · เรท {tx.fxRateToThb}
          </span>
        )}
      </span>
    </button>
  );
}
