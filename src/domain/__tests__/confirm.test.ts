import { describe, expect, it } from "vitest";
import { confirmDraft, confirmIssues } from "../confirm";
import { parseSentence } from "../parser";
import type { Account } from "../types";
import { settings } from "./fixtures";

const accounts: Account[] = [
  { id: "kbank", name: "KBank Visa", type: "credit_card", last4: "4529" },
  { id: "scb", name: "SCB", type: "bank" },
  { id: "cash", name: "เงินสด", type: "cash" },
];
const ctx = { today: "2026-10-01", accounts, settings: settings() };
let n = 0;
const opts = (s = settings()) => ({ settings: s, nowIso: "2026-10-01T00:00:00.000Z", newId: () => `id${++n}`, source: "sentence" as const });

describe("confirmDraft", () => {
  it("locks the current FX rate on a one-off transaction (G8 at confirm time)", () => {
    const [d] = parseSentence("Claude 20$ 4529", ctx);
    const r = confirmDraft(d, opts(settings({ fx: { USD: 34, EUR: 36.4 } })));
    expect(r.type).toBe("transaction");
    if (r.type !== "transaction") return;
    expect(r.transaction).toMatchObject({ kind: "expense", amountMinor: 2_000, currency: "USD", fxRateToThb: 34, accountId: "kbank", status: "confirmed" });
  });

  it("a recurring draft becomes a rule, not money", () => {
    const [d] = parseSentence("ทดลอง Perplexity 20 ดอลลาร์ ถึง 2 ต.ค.", ctx);
    const r = confirmDraft(d, opts());
    expect(r.type).toBe("rule");
    if (r.type !== "rule") return;
    expect(r.rule).toMatchObject({ cadence: "month", startsOn: "2026-10-02", trialEndsOn: "2026-10-02", categoryId: "software" });
  });

  it("transfers keep from/to and no category", () => {
    const [d] = parseSentence("โอน 5,000 จากกสิกรไป SCB", ctx);
    const r = confirmDraft(d, opts());
    if (r.type !== "transaction") throw new Error("expected transaction");
    expect(r.transaction).toMatchObject({ kind: "transfer", fromAccountId: "kbank", toAccountId: "scb" });
    expect(r.transaction.categoryId).toBeUndefined();
    expect(r.transaction.accountId).toBeUndefined();
  });

  it("links a paid occurrence", () => {
    const [d] = parseSentence("จ่าย Netflix 419", ctx);
    const r = confirmDraft(d, { ...opts(), match: { ruleId: "netflix", occurrenceDate: "2026-10-05" } });
    if (r.type !== "transaction") throw new Error("expected transaction");
    expect(r.transaction).toMatchObject({ recurringRuleId: "netflix", occurrenceDate: "2026-10-05" });
  });

  it("refuses unanswered questions, zero amounts and missing rates", () => {
    const [q] = parseSentence("จ่ายบัตร 8,000", ctx);
    expect(() => confirmDraft(q, opts())).toThrow();
    const [zero] = parseSentence("จ่าย 0", ctx);
    expect(confirmIssues(zero, settings())).toContain("ยอดต้องมากกว่า 0");
    const [eur] = parseSentence("Spotify 9.99 ยูโร", ctx);
    expect(confirmIssues(eur, settings({ fx: { USD: 33.25, EUR: 0 } }))).toContain("ตั้งเรทแลกเปลี่ยนก่อนบันทึก");
  });

  it("answering the card question as a transfer makes it neutral", () => {
    const [q] = parseSentence("จ่ายบัตร 8,000", ctx);
    const answered = { ...q, kind: "transfer" as const, fromAccountId: "scb", toAccountId: "kbank" };
    expect(confirmIssues(answered, settings())).toEqual([]);
  });
});
