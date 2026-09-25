import { describe, expect, it } from "vitest";
import { applyTransactionEdit } from "../confirm";
import { filterTransactions, listTotalMinor } from "../totals";
import { settings, tx } from "./fixtures";

const rows = [
  tx({ id: "salary", kind: "income", name: "เงินเดือน", date: "2026-10-01", baht: 45_000 }),
  tx({ id: "coffee", kind: "expense", name: "กาแฟ", date: "2026-10-02", baht: 65 }),
  tx({ id: "claude", kind: "expense", name: "Claude Pro", date: "2026-10-03", amountMinor: 2_000, currency: "USD", fxRateToThb: 33.25, scope: "work" }),
  tx({ id: "refund", kind: "refund", name: "คืนเงินกาแฟ", date: "2026-10-04", baht: 15 }),
  tx({ id: "card", kind: "transfer", name: "จ่ายบัตร", date: "2026-10-04", baht: 5_000, fromAccountId: "scb", toAccountId: "kbank" }),
  tx({ id: "gone", kind: "expense", name: "กาแฟ", date: "2026-10-04", baht: 999, deletedAt: "x" }),
];

describe("A-7 list filter and header total", () => {
  it("all: net without transfers, newest first, no deleted rows", () => {
    const list = filterTransactions(rows, { filter: "all" });
    expect(list.map((t) => t.id).slice(2)).toEqual(["claude", "coffee", "salary"]);
    expect(list.map((t) => t.date)).toEqual(["2026-10-04", "2026-10-04", "2026-10-03", "2026-10-02", "2026-10-01"]);
    expect(list.some((t) => t.id === "gone")).toBe(false);
    expect(listTotalMinor(list, "all")).toBe(4_500_000 - 6_500 - 66_500 + 1_500);
  });

  it("expense chip includes refunds and nets them", () => {
    const list = filterTransactions(rows, { filter: "expense" });
    expect(list.map((t) => t.id).sort()).toEqual(["claude", "coffee", "refund"]);
    expect(listTotalMinor(list, "expense")).toBe(6_500 + 66_500 - 1_500);
  });

  it("income and transfer chips", () => {
    expect(listTotalMinor(filterTransactions(rows, { filter: "income" }), "income")).toBe(4_500_000);
    expect(listTotalMinor(filterTransactions(rows, { filter: "transfer" }), "transfer")).toBe(500_000);
  });

  it("search and work filter combine with chips", () => {
    // "คืนเงินกาแฟ" matches too — search is on the name.
    expect(filterTransactions(rows, { filter: "expense", search: "กาแฟ" }).map((t) => t.id)).toEqual(["refund", "coffee"]);
    expect(filterTransactions(rows, { filter: "all", search: "CLAUDE" }).map((t) => t.id)).toEqual(["claude"]);
    expect(filterTransactions(rows, { filter: "all", workOnly: true }).map((t) => t.id)).toEqual(["claude"]);
    expect(listTotalMinor(filterTransactions(rows, { filter: "expense", search: "กาแฟ" }), "expense")).toBe(6_500 - 1_500);
  });
});

describe("applyTransactionEdit", () => {
  const original = tx({
    id: "claude", kind: "expense", name: "Claude", date: "2026-10-03", amountMinor: 2_000, currency: "USD", fxRateToThb: 33.25,
    categoryId: "software", accountId: "kbank", source: "sentence", recurringRuleId: "r1", occurrenceDate: "2026-10-03",
  });
  const draft = {
    kind: "expense" as const, name: "Claude Pro", amountMinor: 2_200, currency: "USD" as const, date: "2026-10-03",
    cadence: "once" as const, categoryId: "software", accountId: "kbank", scope: "personal" as const, uncertain: [],
  };
  const s = settings({ fx: { USD: 34, EUR: 36.4 } });

  it("keeps id, createdAt, source and the locked rate when the currency is unchanged", () => {
    const edited = applyTransactionEdit(original, draft, { settings: s, nowIso: "later", match: { ruleId: "r1", occurrenceDate: "2026-10-03" } });
    expect(edited).toMatchObject({ id: "claude", createdAt: original.createdAt, source: "sentence", fxRateToThb: 33.25, amountMinor: 2_200, name: "Claude Pro", updatedAt: "later", recurringRuleId: "r1" });
  });

  it("locks today's rate when the currency changes", () => {
    const edited = applyTransactionEdit(original, { ...draft, currency: "EUR" }, { settings: s, nowIso: "later" });
    expect(edited.fxRateToThb).toBe(36.4);
  });

  it("unlinks from the occurrence when no match is passed", () => {
    const edited = applyTransactionEdit(original, draft, { settings: s, nowIso: "later" });
    expect(edited.recurringRuleId).toBeUndefined();
    expect(edited.occurrenceDate).toBeUndefined();
  });

  it("stays a transaction even if the draft says recurring", () => {
    const edited = applyTransactionEdit(original, { ...draft, cadence: "month" }, { settings: s, nowIso: "later" });
    expect(edited.id).toBe("claude");
  });

  it("A-10 refund linked to an original expense lowers actual expense, both rows stay", () => {
    const refund = applyTransactionEdit(
      tx({ id: "rf", kind: "refund", date: "2026-10-05", baht: 1 }),
      { ...draft, kind: "refund", currency: "THB", amountMinor: 3_000, name: "คืนเงิน Claude", refundOfId: "claude" },
      { settings: s, nowIso: "later" },
    );
    expect(refund.refundOfId).toBe("claude");
    const list = filterTransactions([original, refund], { filter: "expense" });
    expect(list).toHaveLength(2);
    expect(listTotalMinor(list, "expense")).toBe(66_500 - 3_000);
  });
});

