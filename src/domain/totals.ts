import { SIDE_INCOME_CATEGORY } from "./categories";
import { inCycle } from "./cycle";
import { maxDate } from "./dates";
import { formatMoney, txThbMinor } from "./money";
import { listOccurrences } from "./recurrence";
import type { Cycle, LocalDate, RecurringRule, Scope, Settings, Transaction } from "./types";

// Summary numbers — docs/02-domain-rules.md §7. Transfers appear in none of these.

export interface BookSlice {
  transactions: Transaction[];
  rules: RecurringRule[];
  settings: Settings;
  cycle: Cycle;
  today: LocalDate;
  /** Optional `งาน`/personal filter; applies to every formula. */
  scope?: Scope;
}

export interface CycleTotals {
  actualIncomeMinor: number;
  actualExpenseMinor: number;
  netMinor: number;
  expectedExpenseMinor: number;
  expectedIncomeMinor: number;
  sideIncomeMinor: number;
  /** Upcoming occurrences left out of the ≈ totals because their currency has no rate. */
  missingFxCount: number;
}

/** Live (not deleted) transactions in the cycle, optionally filtered by scope. */
export function cycleTransactions(slice: Pick<BookSlice, "transactions" | "cycle" | "scope">): Transaction[] {
  return slice.transactions.filter(
    (t) => !t.deletedAt && inCycle(t.date, slice.cycle) && (!slice.scope || t.scope === slice.scope),
  );
}

export function cycleTotals(slice: BookSlice): CycleTotals {
  let income = 0;
  let expense = 0;
  let refund = 0;
  let side = 0;
  for (const t of cycleTransactions(slice)) {
    const thb = txThbMinor(t);
    if (t.kind === "income") {
      income += thb;
      if (t.categoryId === SIDE_INCOME_CATEGORY) side += thb;
    } else if (t.kind === "expense") expense += thb;
    else if (t.kind === "refund") refund += thb;
  }

  let expectedExpense = 0;
  let expectedIncome = 0;
  let missingFx = 0;
  const from = maxDate(slice.today, slice.cycle.start);
  if (from <= slice.cycle.end) {
    const rules = slice.scope ? slice.rules.filter((r) => r.scope === slice.scope) : slice.rules;
    const occurrences = listOccurrences(rules, from, slice.cycle.end, {
      today: slice.today,
      cycleStartDay: slice.settings.cycleStartDay,
      transactions: slice.transactions,
      settings: slice.settings,
    });
    for (const o of occurrences) {
      if (o.status !== "upcoming") continue;
      if (o.approxThbMinor === null) {
        missingFx += 1;
        continue;
      }
      if (o.kind === "expense") expectedExpense += o.approxThbMinor;
      else expectedIncome += o.approxThbMinor;
    }
  }

  const actualExpense = expense - refund;
  return {
    actualIncomeMinor: income,
    actualExpenseMinor: actualExpense,
    netMinor: income - actualExpense,
    expectedExpenseMinor: expectedExpense,
    expectedIncomeMinor: expectedIncome,
    sideIncomeMinor: side,
    missingFxCount: missingFx,
  };
}

export interface SideIncomeProgress {
  amountMinor: number;
  goalMinor: number;
  /** Whole percent, may exceed 100. */
  percent: number;
  /** 0–1 for the progress bar. */
  barFraction: number;
  label: string;
}

export function sideIncomeProgress(amountMinor: number, goalMinor: number): SideIncomeProgress {
  const percent = goalMinor > 0 ? Math.floor((amountMinor * 100) / goalMinor) : 0;
  const barFraction = goalMinor > 0 ? Math.min(1, amountMinor / goalMinor) : 0;
  const gap = goalMinor - amountMinor;
  const label =
    gap > 0 ? `ขาดอีก ${formatMoney(gap, "THB")}` : gap < 0 ? `เกินเป้า ${formatMoney(-gap, "THB")}` : "ถึงเป้าแล้ว";
  return { amountMinor, goalMinor, percent, barFraction, label };
}

/** Category used for spending breakdowns: a refund takes its original expense's category. */
function spendCategory(t: Transaction, byId: Map<string, Transaction>): string {
  if (t.kind === "refund" && t.refundOfId) {
    const original = byId.get(t.refundOfId);
    if (original?.categoryId) return original.categoryId;
  }
  return t.categoryId ?? "other_out";
}

export interface Breakdown {
  key: string;
  /** Expense − refund, THB minor. */
  amountMinor: number;
  count: number;
  sourceIds: string[];
}

function breakdown(txs: Transaction[], all: Transaction[], keyOf: (t: Transaction, byId: Map<string, Transaction>) => string | undefined): Breakdown[] {
  const byId = new Map(all.map((t) => [t.id, t]));
  const groups = new Map<string, Breakdown>();
  for (const t of txs) {
    if (t.kind !== "expense" && t.kind !== "refund") continue;
    const key = keyOf(t, byId);
    if (!key) continue;
    const g = groups.get(key) ?? { key, amountMinor: 0, count: 0, sourceIds: [] };
    g.amountMinor += t.kind === "expense" ? txThbMinor(t) : -txThbMinor(t);
    g.count += 1;
    g.sourceIds.push(t.id);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.amountMinor - a.amountMinor);
}

export const categoryBreakdown = (slice: Pick<BookSlice, "transactions" | "cycle" | "scope">): Breakdown[] =>
  breakdown(cycleTransactions(slice), slice.transactions, spendCategory);

/** Per-account actual spend (expense − refund) — not a balance. */
export const accountBreakdown = (slice: Pick<BookSlice, "transactions" | "cycle" | "scope">): Breakdown[] =>
  breakdown(cycleTransactions(slice), slice.transactions, (t) => t.accountId);

export const dayBreakdown = (slice: Pick<BookSlice, "transactions" | "cycle" | "scope">): Breakdown[] =>
  breakdown(cycleTransactions(slice), slice.transactions, (t) => t.date);
