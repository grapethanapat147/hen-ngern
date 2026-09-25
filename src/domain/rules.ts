import { addDays } from "./dates";
import { approxThbMinor } from "./money";
import { nextOccurrence, occurrenceDates } from "./recurrence";
import type { LocalDate, RecurringRule, Scope, Settings, Transaction } from "./types";

// Managing expected (recurring) items — docs/01-product-brief.md §5.5, docs/02-domain-rules.md §6.

/** Active = not deleted and still has a scheduled date on or after today. */
export function isRuleActive(rule: RecurringRule, today: LocalDate): boolean {
  return !rule.deletedAt && nextOccurrence(rule, today) !== undefined;
}

export const hasLinkedTransactions = (rule: RecurringRule, txs: Transaction[]): boolean =>
  txs.some((t) => !t.deletedAt && t.recurringRuleId === rule.id);

export interface SideSummary {
  monthlyMinor: number;
  yearlyMinor: number;
}

export interface RecurringSummary {
  activeCount: number;
  expense: SideSummary;
  income: SideSummary;
  /** Active rules left out because their currency has no rate. */
  missingFxCount: number;
}

/** ≈ THB per month/year of active rules at today's rate. Yearly is exact; monthly = yearly ÷ 12, rounded once. */
export function recurringSummary(rules: RecurringRule[], settings: Settings, today: LocalDate, scope?: Scope): RecurringSummary {
  const yearly = { expense: 0, income: 0 };
  let activeCount = 0;
  let missingFxCount = 0;
  for (const r of rules) {
    if (!isRuleActive(r, today) || (scope && r.scope !== scope)) continue;
    activeCount += 1;
    const thb = approxThbMinor(r.amountMinor, r.currency, settings);
    if (thb === null) {
      missingFxCount += 1;
      continue;
    }
    yearly[r.kind] += r.cadence === "month" ? thb * 12 : r.cadence === "year" ? thb : thb * 52;
  }
  const side = (y: number): SideSummary => ({ yearlyMinor: y, monthlyMinor: Math.floor((y + 6) / 12) });
  return { activeCount, expense: side(yearly.expense), income: side(yearly.income), missingFxCount };
}

export interface RuleFields {
  name: string;
  amountMinor: number | null;
  startsOn: LocalDate;
  endsOn?: LocalDate;
  maxOccurrences?: number;
  trialEndsOn?: LocalDate;
  kind: RecurringRule["kind"];
}

/** Why a rule form cannot be saved (Thai). */
export function ruleIssues(r: RuleFields): string[] {
  const issues: string[] = [];
  if (!r.name.trim()) issues.push("ใส่ชื่อรายการ");
  if (r.amountMinor === null || r.amountMinor <= 0) issues.push("ยอดต้องมากกว่า 0");
  if (r.endsOn && r.endsOn < r.startsOn) issues.push("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
  if (r.trialEndsOn && r.trialEndsOn > r.startsOn) issues.push("วันหมดช่วงทดลองต้องไม่เกินวันเริ่มหัก");
  if (r.trialEndsOn && r.kind === "income") issues.push("ช่วงทดลองใช้กับรายจ่ายเท่านั้น");
  if (r.maxOccurrences !== undefined && (!Number.isInteger(r.maxOccurrences) || r.maxOccurrences < 1)) issues.push("จำนวนครั้งต้องเป็นจำนวนเต็มบวก");
  return issues;
}

/** Did this rule schedule anything before today? Only then does "from the next time on" differ from editing in place. */
export const hasHistory = (rule: RecurringRule, today: LocalDate): boolean => rule.startsOn < today;

export interface RuleEditResult {
  /** Full replacement rules (updated original, plus a new continuation when split). */
  rules: RecurringRule[];
  newRules: RecurringRule[];
  /** Transactions re-linked from the original to the continuation. */
  transactions: Transaction[];
}

/**
 * Apply an edit "from the next time on" (the default in §5.5):
 * the original keeps its past (ends yesterday, marked superseded) and a new rule carries the edit forward
 * from the first date ≥ today of the edited schedule. Saved transactions never change amounts;
 * any already linked to a date ≥ today move to the new rule so nothing is counted twice.
 * With no history, the rule is simply edited in place.
 */
export function editRuleFromNext(
  original: RecurringRule,
  edited: RecurringRule,
  today: LocalDate,
  opts: { newId: () => string; nowIso: string; transactions: Transaction[] },
): RuleEditResult {
  if (!hasHistory(original, today)) {
    const inPlace = { ...edited, id: original.id, createdAt: original.createdAt, updatedAt: opts.nowIso };
    return { rules: [inPlace], newRules: [], transactions: [] };
  }

  const usedBefore = occurrenceDates(original, original.startsOn, addDays(today, -1)).length;
  const remaining = edited.maxOccurrences !== undefined ? edited.maxOccurrences - usedBefore : undefined;
  const startsOn = edited.startsOn >= today ? edited.startsOn : nextOccurrence({ ...edited, maxOccurrences: undefined }, today);

  const ended: RecurringRule = { ...original, endsOn: addDays(today, -1), updatedAt: opts.nowIso };
  if (!startsOn || (remaining !== undefined && remaining <= 0) || (edited.endsOn && startsOn > edited.endsOn)) {
    return { rules: [ended], newRules: [], transactions: [] };
  }

  const next: RecurringRule = {
    ...edited,
    id: opts.newId(),
    startsOn,
    createdAt: opts.nowIso,
    updatedAt: opts.nowIso,
  };
  if (remaining !== undefined) next.maxOccurrences = remaining;
  else delete next.maxOccurrences;
  if (next.trialEndsOn && next.trialEndsOn < today) delete next.trialEndsOn;
  if (next.trialEndsOn && next.trialEndsOn > startsOn) next.trialEndsOn = startsOn;
  const skipped = (edited.skippedDates ?? []).filter((d) => d >= startsOn);
  if (skipped.length) next.skippedDates = skipped;
  else delete next.skippedDates;
  delete next.supersededBy;
  delete next.deletedAt;
  ended.supersededBy = next.id;

  const transactions = opts.transactions
    .filter((t) => t.recurringRuleId === original.id && t.occurrenceDate && t.occurrenceDate >= today)
    .map((t) => ({ ...t, recurringRuleId: next.id, updatedAt: opts.nowIso }));

  return { rules: [ended, next], newRules: [next], transactions };
}

/** เลิกใช้: no occurrences after today (docs/01 §5.5). */
export function stopRule(rule: RecurringRule, today: LocalDate, nowIso: string): RecurringRule {
  const endsOn = rule.endsOn && rule.endsOn < today ? rule.endsOn : today;
  return { ...rule, endsOn, updatedAt: nowIso };
}

/** ใช้ต่อ: remove the end date. */
export function resumeRule(rule: RecurringRule, nowIso: string): RecurringRule {
  const next = { ...rule, updatedAt: nowIso };
  delete next.endsOn;
  return next;
}
