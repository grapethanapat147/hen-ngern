import { addDays, diffDays } from "./dates";
import { approxThbMinor, txThbMinor } from "./money";
import { listOccurrences, type Occurrence, type OccurrenceContext } from "./recurrence";
import type { LocalDate, RecurringRule, Settings, Transaction, TxKind } from "./types";

// Suggest linking a new actual entry to an expected occurrence (docs/02-domain-rules.md §8).
// Suggestions only — the user always confirms.

export const MATCH_WINDOW_DAYS = 3;

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Names share a word, or one contains the other (Thai has no spaces between words). */
export function namesOverlap(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na.length < 2 || nb.length < 2) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wordsB = new Set(nb.split(" ").filter((w) => w.length >= 2));
  return na.split(" ").some((w) => w.length >= 2 && wordsB.has(w));
}

export interface MatchCandidate {
  kind: TxKind | null;
  name: string;
  date: LocalDate;
}

/** Unmatched upcoming/overdue occurrences of the same kind, within ±3 days, with an overlapping name. Closest first. */
export function suggestMatches(
  draft: MatchCandidate,
  rules: RecurringRule[],
  ctx: OccurrenceContext,
): Occurrence[] {
  if (draft.kind !== "income" && draft.kind !== "expense") return [];
  const from = addDays(draft.date, -MATCH_WINDOW_DAYS);
  const to = addDays(draft.date, MATCH_WINDOW_DAYS);
  return listOccurrences(rules, from, to, ctx)
    .filter(
      (o) =>
        (o.status === "upcoming" || o.status === "overdue") &&
        o.kind === draft.kind &&
        namesOverlap(o.name, draft.name),
    )
    .sort((a, b) => Math.abs(diffDays(draft.date, a.date)) - Math.abs(diffDays(draft.date, b.date)));
}

/** Actual (locked-rate THB) minus expected (≈ THB at today's rate). Shown as `ต่างจากที่คาด +฿30`. */
export function actualVsExpectedDiffMinor(rule: RecurringRule, tx: Transaction, settings: Settings): number | null {
  const expected = approxThbMinor(rule.amountMinor, rule.currency, settings);
  return expected === null ? null : txThbMinor(tx) - expected;
}

/** Unlink a transaction from its occurrence; the occurrence becomes upcoming/overdue again. */
export function unmatch(tx: Transaction): Transaction {
  const rest = { ...tx };
  delete rest.recurringRuleId;
  delete rest.occurrenceDate;
  return rest;
}
