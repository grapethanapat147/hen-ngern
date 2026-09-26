import { categoryName } from "./categories";
import { formatThaiShort } from "./dates";
import { approxThbMinor, formatMoney } from "./money";
import { accountBreakdown, categoryBreakdown, cycleTotals, dayBreakdown, type BookSlice } from "./totals";
import type { Account } from "./types";

// "ความเห็นจากสมุด" — only what can be computed from the book, each with its source rows.

export interface Insight {
  id: "top_category" | "heaviest_day" | "heaviest_account" | "side_gap" | "out_over_in" | "recurring_monthly";
  text: string;
  /** Transaction ids (or rule ids for recurring_monthly) the number comes from. */
  sourceIds: string[];
}

const MAX_INSIGHTS = 6;

export function bookInsights(slice: BookSlice, accounts: Account[]): Insight[] {
  const out: Insight[] = [];
  const totals = cycleTotals(slice);

  const categories = categoryBreakdown(slice).filter((c) => c.amountMinor > 0);
  const top = categories[0];
  if (top && totals.actualExpenseMinor > 0) {
    const share = Math.round((top.amountMinor * 100) / totals.actualExpenseMinor);
    out.push({
      id: "top_category",
      text: `จ่ายหมวด${categoryName(top.key)}มากสุด ${formatMoney(top.amountMinor, "THB")} (${share}% ของจ่ายจริง)`,
      sourceIds: top.sourceIds,
    });
  }

  const day = dayBreakdown(slice).find((d) => d.amountMinor > 0);
  if (day) {
    out.push({
      id: "heaviest_day",
      text: `วันที่จ่ายหนักสุด ${formatThaiShort(day.key)} ${formatMoney(day.amountMinor, "THB")}`,
      sourceIds: day.sourceIds,
    });
  }

  const account = accountBreakdown(slice).find((a) => a.amountMinor > 0);
  const accountName = account && accounts.find((a) => a.id === account.key)?.name;
  if (account && accountName) {
    out.push({
      id: "heaviest_account",
      text: `บัญชีที่จ่ายมากสุด ${accountName} ${formatMoney(account.amountMinor, "THB")}`,
      sourceIds: account.sourceIds,
    });
  }

  const goal = slice.settings.sideIncomeGoalMinor;
  if (goal > 0 && totals.sideIncomeMinor < goal) {
    const sideIds = slice.transactions
      .filter((t) => !t.deletedAt && t.kind === "income" && t.categoryId === "side" && t.date >= slice.cycle.start && t.date <= slice.cycle.end)
      .map((t) => t.id);
    out.push({
      id: "side_gap",
      text: `งานเสริมขาดจากเป้าอีก ${formatMoney(goal - totals.sideIncomeMinor, "THB")}`,
      sourceIds: sideIds,
    });
  }

  if (totals.actualExpenseMinor > totals.actualIncomeMinor) {
    out.push({
      id: "out_over_in",
      text: "รอบนี้เงินออกมากกว่าเข้า ลองดูรายการซ้ำที่ยังใช้อยู่",
      sourceIds: [],
    });
  }

  const monthly = recurringMonthlyExpense(slice);
  if (monthly.ruleIds.length > 0) {
    out.push({
      id: "recurring_monthly",
      text: `บิลซ้ำเฉลี่ยเดือนละ ≈ ${formatMoney(monthly.amountMinor, "THB")}`,
      sourceIds: monthly.ruleIds,
    });
  }

  return out.slice(0, MAX_INSIGHTS);
}

/** Average monthly cost of active expense rules at today's rate: yearly ÷ 12, weekly × 52 ÷ 12. */
export function recurringMonthlyExpense(slice: Pick<BookSlice, "rules" | "settings" | "today" | "scope">): {
  amountMinor: number;
  ruleIds: string[];
} {
  // Sum in "twelfths of a month" so the average stays integer math until one final rounding.
  let totalTwelfths = 0;
  const ruleIds: string[] = [];
  for (const r of slice.rules) {
    if (r.deletedAt || r.kind !== "expense") continue;
    if (r.endsOn && r.endsOn < slice.today) continue;
    if (slice.scope && r.scope !== slice.scope) continue;
    const thb = approxThbMinor(r.amountMinor, r.currency, slice.settings);
    if (thb === null) continue;
    totalTwelfths += r.cadence === "month" ? thb * 12 : r.cadence === "year" ? thb : thb * 52;
    ruleIds.push(r.id);
  }
  return { amountMinor: Math.floor((totalTwelfths + 6) / 12), ruleIds };
}
