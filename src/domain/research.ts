import { diffDays, todayLocal } from "./dates";
import type { AppState, LocalDate } from "./types";

// "ส่งออกสำหรับงานวิจัย" — pilot data (06-experiment-plan.md) with nothing that identifies the person or their money.
// Removed: names, notes, amounts, FX rates, account names, last-4 digits, colours, original ids, times of day,
//          real calendar dates (replaced by day numbers), the cycle start day, and the health category.
// Kept: kinds, categories (health folded into other), currencies, day numbers, account types,
//       links between rows (via new ids), and how rows were made.
// See docs/13-pilot-consent-form.md (option A) — the consent text must match what this file contains.

export const RESEARCH_FORMAT = "henngern-research-v2";

/** Categories that could reveal sensitive (health) information are exported as the generic expense category. */
const SENSITIVE_CATEGORIES: Record<string, string> = { health: "other_out" };
const safeCategory = (id: string | undefined) => (id ? (SENSITIVE_CATEGORIES[id] ?? id) : undefined);

/**
 * Day numbers replace dates: day 1 = the first day the participant saved something themselves.
 * Days before that are ≤ 0. Weeks are rolling 7-day blocks from day 1 (week 1 = days 1–7).
 */
export interface ResearchExport {
  format: typeof RESEARCH_FORMAT;
  /** Day number of the export. */
  exportedDay: number;
  isSample: boolean;
  settings: { workScopeEnabled: boolean };
  accounts: { id: string; type: string; hidden: boolean }[];
  transactions: {
    id: string;
    kind: string;
    currency: string;
    day: number;
    loggedDay: number;
    categoryId?: string;
    accountId?: string;
    fromAccountId?: string;
    toAccountId?: string;
    scope: string;
    source: string;
    ruleId?: string;
    occurrenceDay?: number;
    refundOfId?: string;
    editedAfterSave: boolean;
    deleted: boolean;
    correctedFields?: string[];
  }[];
  rules: {
    id: string;
    kind: string;
    cadence: string;
    currency: string;
    categoryId: string;
    accountId?: string;
    startsDay: number;
    endsDay?: number;
    maxOccurrences?: number;
    hadTrial: boolean;
    skippedCount: number;
    createdDay: number;
    deleted: boolean;
    continuedAsId?: string;
    correctedFields?: string[];
  }[];
  summary: {
    /** Distinct days on which the participant saved something (sample rows excluded). */
    activeDays: number;
    /** Week number (1 = days 1–7 from the first own entry) → active days that week. */
    activeDaysByWeek: Record<string, number>;
    confirmedCount: number;
    fromSentenceCount: number;
    /** Sentence entries saved without any correction. */
    sentenceUncorrectedCount: number;
    /** How often each field had to be fixed after parsing. */
    correctionsByField: Record<string, number>;
    paidOccurrenceCount: number;
    deletedCount: number;
    editedAfterSaveCount: number;
  };
}

/**
 * Build the research export. `localDateOf` turns an ISO timestamp into the user's local date
 * (injectable for tests); dates are only used to compute day numbers and never leave this function.
 */
export function toResearchExport(
  state: AppState,
  opts: { today: LocalDate; localDateOf?: (iso: string) => LocalDate },
): ResearchExport {
  const localDateOf = opts.localDateOf ?? ((iso: string) => todayLocal(new Date(iso)));
  const ids = new Map<string, string>();
  const alias = (prefix: string, id: string | undefined) => {
    if (!id) return undefined;
    const key = `${prefix}:${id}`;
    if (!ids.has(key)) ids.set(key, `${prefix}${[...ids.keys()].filter((k) => k.startsWith(`${prefix}:`)).length + 1}`);
    return ids.get(key);
  };
  // Assign ids in a stable order first so links resolve to the same alias.
  state.accounts.forEach((a) => alias("a", a.id));
  state.rules.forEach((r) => alias("r", r.id));
  state.transactions.forEach((t) => alias("t", t.id));

  // Summary counts only the user's own rows (sample rows are demo data).
  const own = state.transactions.filter((t) => t.source !== "sample");
  const ownRules = state.rules.filter((r) => r.note !== "ตัวอย่าง ไม่ใช่ยอดจริง");
  const ownLogged = [...own.map((t) => localDateOf(t.createdAt)), ...ownRules.map((r) => localDateOf(r.createdAt))];
  const allLogged = [...state.transactions.map((t) => localDateOf(t.createdAt)), ...state.rules.map((r) => localDateOf(r.createdAt))];
  const anchor = [...(ownLogged.length ? ownLogged : allLogged.length ? allLogged : [opts.today])].sort()[0];
  const dayOf = (d: LocalDate) => diffDays(anchor, d) + 1;

  const transactions = state.transactions.map((t) => ({
    id: alias("t", t.id)!,
    kind: t.kind,
    currency: t.currency,
    day: dayOf(t.date),
    loggedDay: dayOf(localDateOf(t.createdAt)),
    ...(t.categoryId ? { categoryId: safeCategory(t.categoryId) } : {}),
    ...(t.accountId ? { accountId: alias("a", t.accountId) } : {}),
    ...(t.fromAccountId ? { fromAccountId: alias("a", t.fromAccountId), toAccountId: alias("a", t.toAccountId) } : {}),
    scope: t.scope,
    source: t.source,
    ...(t.recurringRuleId ? { ruleId: alias("r", t.recurringRuleId), occurrenceDay: t.occurrenceDate ? dayOf(t.occurrenceDate) : undefined } : {}),
    ...(t.refundOfId ? { refundOfId: alias("t", t.refundOfId) } : {}),
    editedAfterSave: t.updatedAt !== t.createdAt && !t.deletedAt,
    deleted: Boolean(t.deletedAt),
    ...(t.correctedFields ? { correctedFields: [...t.correctedFields] } : {}),
  }));

  const rules = state.rules.map((r) => ({
    id: alias("r", r.id)!,
    kind: r.kind,
    cadence: r.cadence,
    currency: r.currency,
    categoryId: safeCategory(r.categoryId)!,
    ...(r.accountId ? { accountId: alias("a", r.accountId) } : {}),
    startsDay: dayOf(r.startsOn),
    ...(r.endsOn ? { endsDay: dayOf(r.endsOn) } : {}),
    ...(r.maxOccurrences ? { maxOccurrences: r.maxOccurrences } : {}),
    hadTrial: Boolean(r.trialEndsOn),
    skippedCount: r.skippedDates?.length ?? 0,
    createdDay: dayOf(localDateOf(r.createdAt)),
    deleted: Boolean(r.deletedAt),
    ...(r.supersededBy ? { continuedAsId: alias("r", r.supersededBy) } : {}),
    ...(r.correctedFields ? { correctedFields: [...r.correctedFields] } : {}),
  }));

  const activeDayNumbers = [...new Set(ownLogged.map(dayOf))].sort((a, b) => a - b);
  const byWeek: Record<string, number> = {};
  for (const d of activeDayNumbers) {
    const week = String(Math.floor((d - 1) / 7) + 1);
    byWeek[week] = (byWeek[week] ?? 0) + 1;
  }
  const sentenceRecords = [...own.filter((t) => t.source === "sentence"), ...ownRules.filter((r) => r.correctedFields !== undefined)];
  const correctionsByField: Record<string, number> = {};
  for (const rec of sentenceRecords) for (const f of rec.correctedFields ?? []) correctionsByField[f] = (correctionsByField[f] ?? 0) + 1;
  const live = own.filter((t) => !t.deletedAt);

  return {
    format: RESEARCH_FORMAT,
    exportedDay: dayOf(opts.today),
    isSample: state.isSample,
    settings: { workScopeEnabled: state.settings.workScopeEnabled },
    accounts: state.accounts.map((a) => ({ id: alias("a", a.id)!, type: a.type, hidden: Boolean(a.hidden) })),
    transactions,
    rules,
    summary: {
      activeDays: activeDayNumbers.length,
      activeDaysByWeek: byWeek,
      confirmedCount: live.length,
      fromSentenceCount: sentenceRecords.length,
      sentenceUncorrectedCount: sentenceRecords.filter((r) => (r.correctedFields ?? []).length === 0).length,
      correctionsByField,
      paidOccurrenceCount: live.filter((t) => t.recurringRuleId).length,
      deletedCount: own.filter((t) => t.deletedAt).length,
      editedAfterSaveCount: live.filter((t) => t.updatedAt !== t.createdAt).length,
    },
  };
}
