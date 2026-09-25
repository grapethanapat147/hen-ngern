import { cycleFor } from "./cycle";
import { addDays, clampedDate, diffDays, parseLocalDate } from "./dates";
import { approxThbMinor } from "./money";
import type { Currency, LocalDate, RecurringRule, Settings, Transaction } from "./types";

// Occurrences are computed on demand and never stored (docs/02-domain-rules.md §6).

const MAX_ITERATIONS = 5_000;

/** The i-th scheduled date of a rule (0 = startsOn), anchored to startsOn's day. */
function nthDate(rule: RecurringRule, i: number): LocalDate {
  const { y, m, d } = parseLocalDate(rule.startsOn);
  switch (rule.cadence) {
    case "week":
      return addDays(rule.startsOn, i * 7);
    case "month":
      return clampedDate(y, m + i, d);
    case "year":
      return clampedDate(y + i, m, d);
  }
}

/** Scheduled dates within [from, to], after end/limit/skip rules. Deleted rules have none. */
export function occurrenceDates(rule: RecurringRule, from: LocalDate, to: LocalDate): LocalDate[] {
  if (rule.deletedAt) return [];
  const skipped = new Set(rule.skippedDates ?? []);
  const out: LocalDate[] = [];
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (rule.maxOccurrences !== undefined && i >= rule.maxOccurrences) break;
    const date = nthDate(rule, i);
    if (date > to) break;
    if (rule.endsOn && date > rule.endsOn) break;
    if (date >= from && !skipped.has(date)) out.push(date);
  }
  return out;
}

/**
 * matched  — a live transaction is linked to this rule + date
 * upcoming — not matched, date ≥ today
 * overdue  — not matched, date < today, inside the current cycle
 * past     — not matched, before the current cycle (calendar only, not on ภาพรวม)
 */
export type OccurrenceStatus = "matched" | "upcoming" | "overdue" | "past";

export interface Occurrence {
  ruleId: string;
  kind: RecurringRule["kind"];
  name: string;
  date: LocalDate;
  amountMinor: number;
  currency: Currency;
  /** ≈ THB at today's rate; null when the rate is missing. */
  approxThbMinor: number | null;
  categoryId: string;
  accountId?: string;
  scope: RecurringRule["scope"];
  status: OccurrenceStatus;
  matchedTransactionId?: string;
}

export interface OccurrenceContext {
  today: LocalDate;
  cycleStartDay: number;
  transactions: Transaction[];
  settings: Settings;
}

const matchKey = (ruleId: string, date: LocalDate) => `${ruleId}|${date}`;

export function matchIndex(transactions: Transaction[]): Map<string, Transaction> {
  const index = new Map<string, Transaction>();
  for (const t of transactions) {
    if (t.deletedAt || !t.recurringRuleId || !t.occurrenceDate) continue;
    index.set(matchKey(t.recurringRuleId, t.occurrenceDate), t);
  }
  return index;
}

/** All occurrences of `rules` in [from, to], sorted by date, with computed status. */
export function listOccurrences(
  rules: RecurringRule[],
  from: LocalDate,
  to: LocalDate,
  ctx: OccurrenceContext,
): Occurrence[] {
  const matches = matchIndex(ctx.transactions);
  const current = cycleFor(ctx.today, ctx.cycleStartDay);
  const out: Occurrence[] = [];
  for (const rule of rules) {
    for (const date of occurrenceDates(rule, from, to)) {
      const matched = matches.get(matchKey(rule.id, date));
      const status: OccurrenceStatus = matched
        ? "matched"
        : date >= ctx.today
          ? "upcoming"
          : date >= current.start
            ? "overdue"
            : "past";
      out.push({
        ruleId: rule.id,
        kind: rule.kind,
        name: rule.name,
        date,
        amountMinor: rule.amountMinor,
        currency: rule.currency,
        approxThbMinor: approxThbMinor(rule.amountMinor, rule.currency, ctx.settings),
        categoryId: rule.categoryId,
        accountId: rule.accountId,
        scope: rule.scope,
        status,
        matchedTransactionId: matched?.id,
      });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** First scheduled date on or after `from`, or undefined if the rule has ended. */
export function nextOccurrence(rule: RecurringRule, from: LocalDate): LocalDate | undefined {
  // A year is enough for weekly/monthly; yearly rules need just over a year.
  return occurrenceDates(rule, from, addDays(from, 367))[0];
}

export interface TrialInfo {
  ruleId: string;
  name: string;
  trialEndsOn: LocalDate;
  daysLeft: number;
  firstChargeOn?: LocalDate;
  amountMinor: number;
  currency: Currency;
  chargeThbMinor: number | null;
}

/** Trial countdown for a rule whose trial has not ended yet; undefined otherwise. */
export function trialInfo(rule: RecurringRule, today: LocalDate, settings: Settings): TrialInfo | undefined {
  if (rule.deletedAt || !rule.trialEndsOn || rule.trialEndsOn < today) return undefined;
  return {
    ruleId: rule.id,
    name: rule.name,
    trialEndsOn: rule.trialEndsOn,
    daysLeft: diffDays(today, rule.trialEndsOn),
    firstChargeOn: nextOccurrence(rule, rule.trialEndsOn),
    amountMinor: rule.amountMinor,
    currency: rule.currency,
    chargeThbMinor: approxThbMinor(rule.amountMinor, rule.currency, settings),
  };
}
