import { currentRate } from "./money";
import { draftIssues, type Draft } from "./parser";
import type { LocalDate, RecurringRule, Settings, Transaction } from "./types";

// Turning a reviewed draft into a stored record. The FX rate is locked here (docs/02-domain-rules.md §4).

export interface ConfirmOptions {
  settings: Settings;
  nowIso: string;
  newId: () => string;
  source: Transaction["source"];
  /** Link to an expected occurrence (จ่ายแล้ว / accepted match suggestion). */
  match?: { ruleId: string; occurrenceDate: LocalDate };
  refundOfId?: string;
}

export type ConfirmResult = { type: "transaction"; transaction: Transaction } | { type: "rule"; rule: RecurringRule };

/** Everything that blocks saving, in Thai; empty = can save. */
export function confirmIssues(draft: Draft, settings: Settings): string[] {
  const issues = draftIssues(draft);
  if (currentRate(draft.currency, settings) === null) issues.push("ตั้งเรทแลกเปลี่ยนก่อนบันทึก");
  if (draft.cadence !== "once" && draft.kind !== null && draft.kind !== "income" && draft.kind !== "expense") {
    issues.push("รายการซ้ำต้องเป็นรายรับหรือรายจ่าย");
  }
  if (draft.cadence !== "once" && draft.trialEndsOn && draft.trialEndsOn > draft.date) {
    issues.push("วันหมดช่วงทดลองต้องไม่เกินวันเริ่มหัก");
  }
  if (draft.cadence !== "once" && draft.endsOn && draft.endsOn < draft.date) {
    issues.push("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
  }
  return issues;
}

export function confirmDraft(draft: Draft, opts: ConfirmOptions): ConfirmResult {
  const issues = confirmIssues(draft, opts.settings);
  if (issues.length > 0 || draft.kind === null || draft.amountMinor === null) {
    throw new Error(`Draft cannot be saved: ${issues.join(", ")}`);
  }
  const base = {
    id: opts.newId(),
    name: draft.name.trim(),
    amountMinor: draft.amountMinor,
    currency: draft.currency,
    scope: draft.scope,
    createdAt: opts.nowIso,
    updatedAt: opts.nowIso,
  };

  if (draft.cadence !== "once") {
    const kind = draft.kind as RecurringRule["kind"];
    return {
      type: "rule",
      rule: {
        ...base,
        kind,
        cadence: draft.cadence,
        startsOn: draft.date,
        ...(draft.trialEndsOn ? { trialEndsOn: draft.trialEndsOn } : {}),
        ...(draft.endsOn ? { endsOn: draft.endsOn } : {}),
        ...(draft.maxOccurrences ? { maxOccurrences: draft.maxOccurrences } : {}),
        categoryId: draft.categoryId ?? (kind === "income" ? "other_in" : "other_out"),
        ...(draft.accountId ? { accountId: draft.accountId } : {}),
      },
    };
  }

  const transaction: Transaction = {
    ...base,
    kind: draft.kind,
    fxRateToThb: currentRate(draft.currency, opts.settings)!,
    date: draft.date,
    source: opts.source,
    status: "confirmed",
  };
  if (draft.kind === "transfer") {
    transaction.fromAccountId = draft.fromAccountId;
    transaction.toAccountId = draft.toAccountId;
  } else {
    if (draft.categoryId) transaction.categoryId = draft.categoryId;
    if (draft.accountId) transaction.accountId = draft.accountId;
  }
  if (opts.match) {
    transaction.recurringRuleId = opts.match.ruleId;
    transaction.occurrenceDate = opts.match.occurrenceDate;
  }
  if (draft.kind === "refund" && opts.refundOfId) transaction.refundOfId = opts.refundOfId;
  return { type: "transaction", transaction };
}
