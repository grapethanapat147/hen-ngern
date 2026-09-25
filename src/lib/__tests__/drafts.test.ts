import { describe, expect, it } from "vitest";
import { cycleTotals } from "@/domain/totals";
import { cycleFor } from "@/domain/cycle";
import { confirmDraft } from "@/domain/confirm";
import { parseSentence } from "@/domain/parser";
import { listOccurrences } from "@/domain/recurrence";
import { DEFAULT_SETTINGS, type Account } from "@/domain/types";
import { answerQuestion, changeKind, draftFromOccurrence, editDraft, editableIssues, minorToInput, toEditable } from "../drafts";

const accounts: Account[] = [
  { id: "kbank", name: "KBank Visa", type: "credit_card", last4: "4529" },
  { id: "scb", name: "SCB", type: "bank" },
  { id: "cash", name: "เงินสด", type: "cash" },
];
const ctx = { today: "2026-10-01", accounts, settings: DEFAULT_SETTINGS };
const draft = (text: string) => toEditable(parseSentence(text, ctx)[0], "k");

describe("review-sheet drafts", () => {
  it("amount text round-trips", () => {
    expect(minorToInput(450_000)).toBe("4500");
    expect(minorToInput(999)).toBe("9.99");
    expect(minorToInput(5)).toBe("0.05");
  });

  it("editing a flagged field clears its flag", () => {
    const d = draft("แท็กซี่ 220");
    expect(d.uncertain).toContain("kind");
    expect(changeKind(d, "expense", accounts).uncertain).not.toContain("kind");
    const a = editDraft(d, "account", { accountId: "kbank" });
    expect(a.uncertain).not.toContain("account");
  });

  it("typing a bad amount blocks saving", () => {
    const d = editDraft(draft("กาแฟ 65"), "amount", { amountText: "6,5,5x" });
    expect(d.amountMinor).toBeNull();
    expect(editableIssues(d, DEFAULT_SETTINGS)).toContain("ยอดต้องมากกว่า 0");
  });

  it("A-6 — card question: blocked until answered, card payment becomes a neutral transfer", () => {
    const q = draft("จ่ายบัตร 8,000");
    expect(editableIssues(q, DEFAULT_SETTINGS)).toContain("ตอบคำถามก่อนบันทึก");
    const answered = answerQuestion(q, "transfer", accounts);
    expect(answered).toMatchObject({ kind: "transfer", fromAccountId: "scb", toAccountId: "kbank" });
    expect(answered.accountId).toBeUndefined();
    expect(editableIssues(answered, DEFAULT_SETTINGS)).toEqual([]);
    const r = confirmDraft(answered, { settings: DEFAULT_SETTINGS, nowIso: "x", newId: () => "t1", source: "sentence" });
    if (r.type !== "transaction") throw new Error("expected transaction");
    const cycle = cycleFor("2026-10-01", 1);
    const t = cycleTotals({ transactions: [r.transaction], rules: [], settings: DEFAULT_SETTINGS, cycle, today: "2026-10-01" });
    expect(t.actualExpenseMinor).toBe(0);
  });

  it("card question answered as a new expense", () => {
    const answered = answerQuestion(draft("จ่ายบัตร 8,000"), "expense", accounts);
    expect(answered).toMatchObject({ kind: "expense", categoryId: "other_out" });
    expect(editableIssues(answered, DEFAULT_SETTINGS)).toEqual([]);
  });

  it("transfer question answered as own-account transfer picks two different accounts", () => {
    const answered = answerQuestion(draft("โอน 2500"), "transfer", accounts);
    expect(answered.fromAccountId).toBe("scb");
    expect(answered.toAccountId).not.toBe("scb");
  });

  it("switching income ↔ expense resets a mismatched category", () => {
    const d = changeKind(draft("ได้ค่างาน 4500"), "expense", accounts);
    expect(d.categoryId).toBe("other_out");
    expect(d.uncertain).toContain("category");
  });

  it("paying an occurrence pre-fills the draft and links it", () => {
    const rule = {
      id: "netflix", kind: "expense" as const, name: "Netflix", amountMinor: 41_900, currency: "THB" as const,
      cadence: "month" as const, startsOn: "2026-09-05", categoryId: "entertainment", accountId: "kbank",
      scope: "personal" as const, createdAt: "x", updatedAt: "x",
    };
    const [occ] = listOccurrences([rule], "2026-10-01", "2026-10-31", { today: "2026-10-01", cycleStartDay: 1, transactions: [], settings: DEFAULT_SETTINGS });
    const d = draftFromOccurrence(occ, "k");
    expect(d).toMatchObject({ name: "Netflix", amountText: "419", date: "2026-10-05", match: { ruleId: "netflix", occurrenceDate: "2026-10-05" } });
    expect(editableIssues(d, DEFAULT_SETTINGS)).toEqual([]);
  });

  it("recurring end fields are validated and saved", () => {
    const d = { ...draft("ค่าเช่า 6500 ทุกเดือนวันที่ 1"), endsOn: "2026-09-01" };
    expect(editableIssues(d, DEFAULT_SETTINGS)).toContain("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
    const ok = { ...d, endsOn: "2027-09-30", maxOccurrences: 12 };
    const r = confirmDraft(ok, { settings: DEFAULT_SETTINGS, nowIso: "x", newId: () => "r1", source: "sentence" });
    if (r.type !== "rule") throw new Error("expected rule");
    expect(r.rule).toMatchObject({ endsOn: "2027-09-30", maxOccurrences: 12 });
  });
});
