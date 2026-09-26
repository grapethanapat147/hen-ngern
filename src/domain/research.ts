import { addDays, dayOfWeek, todayLocal } from "./dates";
import type { AppState, LocalDate } from "./types";

// "ส่งออกสำหรับงานวิจัย" — pilot data (06-experiment-plan.md) with nothing that identifies the person or their money.
// Removed: names, notes, amounts, FX rates, account names, last-4 digits, colours, original ids, times of day.
// Kept: kinds, categories, currencies, dates, account types, links between rows (via new ids), and how rows were made.

export const RESEARCH_FORMAT = "henngern-research-v1";

export interface ResearchExport {
  format: typeof RESEARCH_FORMAT;
  exportedOn: LocalDate;
  isSample: boolean;
  settings: { cycleStartDay: number; workScopeEnabled: boolean };
  accounts: { id: string; type: string; hidden: boolean }[];
  transactions: {
    id: string;
    kind: string;
    currency: string;
    date: LocalDate;
    loggedOn: LocalDate;
    categoryId?: string;
    accountId?: string;
    fromAccountId?: string;
    toAccountId?: string;
    scope: string;
    source: string;
    ruleId?: string;
    occurrenceDate?: LocalDate;
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
    startsOn: LocalDate;
    endsOn?: LocalDate;
    maxOccurrences?: number;
    hadTrial: boolean;
    skippedCount: number;
    createdOn: LocalDate;
    deleted: boolean;
    continuedAsId?: string;
    correctedFields?: string[];
  }[];
  summary: {
    /** Distinct local days on which something was saved (sample rows excluded). */
    activeDays: number;
    /** Monday-start week → active days that week. */
    activeDaysByWeek: Record<LocalDate, number>;
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

const weekStart = (d: LocalDate) => addDays(d, -((dayOfWeek(d) + 6) % 7));

/**
 * Build the research export. `localDateOf` turns an ISO timestamp into the user's local date
 * (injectable for tests); only the date is kept, never the time.
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

  const transactions = state.transactions.map((t) => ({
    id: alias("t", t.id)!,
    kind: t.kind,
    currency: t.currency,
    date: t.date,
    loggedOn: localDateOf(t.createdAt),
    ...(t.categoryId ? { categoryId: t.categoryId } : {}),
    ...(t.accountId ? { accountId: alias("a", t.accountId) } : {}),
    ...(t.fromAccountId ? { fromAccountId: alias("a", t.fromAccountId), toAccountId: alias("a", t.toAccountId) } : {}),
    scope: t.scope,
    source: t.source,
    ...(t.recurringRuleId ? { ruleId: alias("r", t.recurringRuleId), occurrenceDate: t.occurrenceDate } : {}),
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
    categoryId: r.categoryId,
    ...(r.accountId ? { accountId: alias("a", r.accountId) } : {}),
    startsOn: r.startsOn,
    ...(r.endsOn ? { endsOn: r.endsOn } : {}),
    ...(r.maxOccurrences ? { maxOccurrences: r.maxOccurrences } : {}),
    hadTrial: Boolean(r.trialEndsOn),
    skippedCount: r.skippedDates?.length ?? 0,
    createdOn: localDateOf(r.createdAt),
    deleted: Boolean(r.deletedAt),
    ...(r.supersededBy ? { continuedAsId: alias("r", r.supersededBy) } : {}),
    ...(r.correctedFields ? { correctedFields: [...r.correctedFields] } : {}),
  }));

  // Summary counts only the user's own rows (sample rows are demo data).
  const own = state.transactions.filter((t) => t.source !== "sample");
  const ownRules = state.rules.filter((r) => r.note !== "ตัวอย่าง ไม่ใช่ยอดจริง");
  const days = new Set<LocalDate>([...own.map((t) => localDateOf(t.createdAt)), ...ownRules.map((r) => localDateOf(r.createdAt))]);
  const byWeek: Record<LocalDate, number> = {};
  for (const d of [...days].sort()) byWeek[weekStart(d)] = (byWeek[weekStart(d)] ?? 0) + 1;
  const sentenceRecords = [...own.filter((t) => t.source === "sentence"), ...ownRules.filter((r) => r.correctedFields !== undefined)];
  const correctionsByField: Record<string, number> = {};
  for (const rec of sentenceRecords) for (const f of rec.correctedFields ?? []) correctionsByField[f] = (correctionsByField[f] ?? 0) + 1;
  const live = own.filter((t) => !t.deletedAt);

  return {
    format: RESEARCH_FORMAT,
    exportedOn: opts.today,
    isSample: state.isSample,
    settings: { cycleStartDay: state.settings.cycleStartDay, workScopeEnabled: state.settings.workScopeEnabled },
    accounts: state.accounts.map((a) => ({ id: alias("a", a.id)!, type: a.type, hidden: Boolean(a.hidden) })),
    transactions,
    rules,
    summary: {
      activeDays: days.size,
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

