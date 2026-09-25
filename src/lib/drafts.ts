import { categoryById } from "@/domain/categories";
import { confirmIssues } from "@/domain/confirm";
import { parseAmountToMinor } from "@/domain/money";
import type { Draft, UncertainField } from "@/domain/parser";
import type { Occurrence } from "@/domain/recurrence";
import type { Account, LocalDate, RecurringRule, Settings, Transaction, TxKind } from "@/domain/types";

// Review-sheet state for drafts: pure helpers so the rules are unit-tested outside React.

export interface EditableDraft extends Draft {
  key: string;
  /** What the user typed in the amount box. */
  amountText: string;
  /** Accepted link to an expected occurrence. */
  match?: { ruleId: string; occurrenceDate: LocalDate; ruleName: string };
  /** User said "ไม่ใช่" to the match suggestion. */
  matchDismissed?: boolean;
  /** Opened from จ่ายแล้ว/ได้รับแล้ว: the link is fixed. */
  lockedMatch?: boolean;
}

export function minorToInput(minor: number | null): string {
  if (minor === null) return "";
  const whole = Math.trunc(minor / 100);
  const frac = minor % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0")}`;
}

export const toEditable = (draft: Draft, key: string): EditableDraft => ({
  ...draft,
  key,
  amountText: minorToInput(draft.amountMinor),
});

/** Apply a field change and clear that field's "ตรวจช่องนี้" flag. */
export function editDraft(d: EditableDraft, field: UncertainField | null, patch: Partial<EditableDraft>): EditableDraft {
  const next: EditableDraft = { ...d, ...patch };
  if ("amountText" in patch) next.amountMinor = parseAmountToMinor(patch.amountText ?? "");
  if (field) next.uncertain = d.uncertain.filter((f) => f !== field);
  return next;
}

function pickTransferAccounts(accounts: Account[], preferCardAsTarget: boolean): { from?: string; to?: string } {
  const visible = accounts.filter((a) => !a.hidden);
  const card = visible.find((a) => a.type === "credit_card");
  const bank = visible.find((a) => a.type === "bank");
  const to = preferCardAsTarget ? card ?? visible.find((a) => a.id !== bank?.id) : visible.find((a) => a.id !== bank?.id && a.type !== "cash") ?? visible.find((a) => a.id !== bank?.id);
  const from = bank && bank.id !== to?.id ? bank : visible.find((a) => a.id !== to?.id);
  return { from: from?.id, to: to?.id };
}

/** Switch kind, keeping fields consistent (transfer ↔ account/category). */
export function changeKind(d: EditableDraft, kind: TxKind, accounts: Account[]): EditableDraft {
  const next: EditableDraft = { ...d, kind, uncertain: d.uncertain.filter((f) => f !== "kind") };
  if (kind === "transfer") {
    const picked = pickTransferAccounts(accounts, d.question === "card_payment_or_expense");
    next.fromAccountId = d.fromAccountId ?? picked.from;
    next.toAccountId = d.toAccountId ?? picked.to;
    delete next.categoryId;
    delete next.accountId;
    next.cadence = "once";
    next.uncertain = next.uncertain.filter((f) => f !== "category" && f !== "account");
    return next;
  }
  delete next.fromAccountId;
  delete next.toAccountId;
  if (!next.accountId) next.accountId = accounts.find((a) => a.type === "cash" && !a.hidden)?.id;
  const wanted = kind === "income" ? "income" : "expense";
  if (categoryById(next.categoryId)?.kind !== wanted) {
    next.categoryId = wanted === "income" ? "other_in" : "other_out";
    if (!next.uncertain.includes("category")) next.uncertain = [...next.uncertain, "category"];
  }
  if (kind === "refund") next.cadence = "once";
  return next;
}

/** Answer a mandatory question (A-6). */
export function answerQuestion(d: EditableDraft, choice: "transfer" | "expense", accounts: Account[]): EditableDraft {
  return changeKind(d, choice, accounts);
}

export function draftFromOccurrence(o: Occurrence, key: string): EditableDraft {
  return {
    key,
    kind: o.kind,
    name: o.name,
    amountMinor: o.amountMinor,
    amountText: minorToInput(o.amountMinor),
    currency: o.currency,
    date: o.date,
    cadence: "once",
    categoryId: o.categoryId,
    accountId: o.accountId,
    scope: o.scope,
    uncertain: [],
    match: { ruleId: o.ruleId, occurrenceDate: o.date, ruleName: o.name },
    lockedMatch: true,
  };
}

/** Reasons the draft cannot be saved (Thai). */
export function editableIssues(d: EditableDraft, settings: Settings): string[] {
  const issues = confirmIssues(d, settings);
  if (d.amountText.trim() !== "" && d.amountMinor === null && !issues.includes("ยอดต้องมากกว่า 0")) {
    issues.push("ยอดต้องมากกว่า 0");
  }
  return issues;
}

/** An empty manual draft for "+ รายการ". */
export function blankDraft(today: LocalDate, accounts: Account[], key: string): EditableDraft {
  return {
    key,
    kind: "expense",
    name: "",
    amountMinor: null,
    amountText: "",
    currency: "THB",
    date: today,
    cadence: "once",
    categoryId: "other_out",
    accountId: accounts.find((a) => a.type === "cash" && !a.hidden)?.id,
    scope: "personal",
    uncertain: [],
  };
}

/** A saved transaction opened for editing. */
export function draftFromTransaction(t: Transaction, rules: RecurringRule[]): EditableDraft {
  const rule = t.recurringRuleId ? rules.find((r) => r.id === t.recurringRuleId) : undefined;
  return {
    key: t.id,
    kind: t.kind,
    name: t.name,
    amountMinor: t.amountMinor,
    amountText: minorToInput(t.amountMinor),
    currency: t.currency,
    date: t.date,
    cadence: "once",
    ...(t.categoryId ? { categoryId: t.categoryId } : {}),
    ...(t.accountId ? { accountId: t.accountId } : {}),
    ...(t.fromAccountId ? { fromAccountId: t.fromAccountId, toAccountId: t.toAccountId } : {}),
    ...(t.refundOfId ? { refundOfId: t.refundOfId } : {}),
    scope: t.scope,
    uncertain: [],
    ...(t.recurringRuleId && t.occurrenceDate
      ? { match: { ruleId: t.recurringRuleId, occurrenceDate: t.occurrenceDate, ruleName: rule?.name ?? t.name } }
      : {}),
  };
}

let keySeq = 0;
/** Unique React key for a new draft. */
export const nextDraftKey = (prefix = "draft"): string => `${prefix}-${++keySeq}`;
