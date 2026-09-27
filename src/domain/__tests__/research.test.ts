import { describe, expect, it } from "vitest";
import { buildSampleState } from "@/data/sample";
import { toResearchExport } from "../research";
import type { AppState } from "../types";
import { DEFAULT_SETTINGS } from "../types";
import { rule, tx } from "./fixtures";

const localDateOf = (iso: string) => iso.slice(0, 10);

const state: AppState = {
  schemaVersion: 1,
  isSample: false,
  settings: DEFAULT_SETTINGS,
  accounts: [
    { id: "acc-kbank", name: "KBank Visa ของแม่", type: "credit_card", last4: "4529", color: "#0B6B66" },
    { id: "acc-cash", name: "เงินสด", type: "cash" },
  ],
  rules: [
    rule({ id: "rule-nf", name: "Netflix บ้านสมชาย", baht: 419, cadence: "month", startsOn: "2026-10-05", categoryId: "entertainment", accountId: "acc-kbank", note: "แชร์กับพี่", createdAt: "2026-10-01T02:00:00.000Z", correctedFields: [] }),
  ],
  transactions: [
    tx({ id: "tx-1", kind: "expense", name: "ค่ายาคุณหมอสมศรี", date: "2026-10-01", baht: 1234, accountId: "acc-kbank", categoryId: "health", note: "ลับ", source: "sentence", correctedFields: ["category"], createdAt: "2026-10-01T03:00:00.000Z", updatedAt: "2026-10-01T03:00:00.000Z" }),
    tx({ id: "tx-2", kind: "expense", name: "Netflix", date: "2026-10-05", baht: 419, recurringRuleId: "rule-nf", occurrenceDate: "2026-10-05", source: "manual", createdAt: "2026-10-05T03:00:00.000Z", updatedAt: "2026-10-06T03:00:00.000Z" }),
    tx({ id: "tx-3", kind: "refund", name: "คืนค่ายา", date: "2026-10-07", baht: 100, categoryId: "health", refundOfId: "tx-1", source: "sentence", correctedFields: [], createdAt: "2026-10-07T03:00:00.000Z", updatedAt: "2026-10-07T03:00:00.000Z" }),
    tx({ id: "tx-4", kind: "transfer", name: "โอนให้ตัวเอง", date: "2026-10-12", baht: 5000, fromAccountId: "acc-cash", toAccountId: "acc-kbank", source: "manual", deletedAt: "2026-10-12T05:00:00.000Z", createdAt: "2026-10-12T03:00:00.000Z", updatedAt: "2026-10-12T05:00:00.000Z" }),
  ],
};

const out = toResearchExport(state, { today: "2026-10-15", localDateOf });
const json = JSON.stringify(out);

describe("research export", () => {
  it("contains no names, notes, amounts, account names, last-4, colours or original ids", () => {
    for (const secret of ["ค่ายาคุณหมอสมศรี", "Netflix", "สมชาย", "แชร์กับพี่", "ลับ", "KBank", "ของแม่", "4529", "#0B6B66", "1234", "123400", "41900", "419", "amountMinor", "fxRate", "acc-kbank", "tx-1", "rule-nf", "T03:00", "2026-", "health", "cycleStartDay"]) {
      expect(json, secret).not.toContain(secret);
    }
  });

  it("keeps links between rows through new ids", () => {
    const [t1, t2, t3, t4] = out.transactions;
    expect(t1).toMatchObject({ id: "t1", kind: "expense", accountId: "a1", day: 1, loggedDay: 1, categoryId: "other_out", correctedFields: ["category"] });
    expect(t2).toMatchObject({ ruleId: "r1", day: 5, occurrenceDay: 5, editedAfterSave: true });
    expect(t3).toMatchObject({ refundOfId: "t1", categoryId: "other_out", day: 7 });
    expect(t4).toMatchObject({ fromAccountId: "a2", toAccountId: "a1", deleted: true, editedAfterSave: false });
    expect(out.rules[0]).toMatchObject({ id: "r1", accountId: "a1", categoryId: "entertainment", hadTrial: false, startsDay: 5, createdDay: 1 });
    expect(out.exportedDay).toBe(15);
    expect(out.accounts).toEqual([
      { id: "a1", type: "credit_card", hidden: false },
      { id: "a2", type: "cash", hidden: false },
    ]);
  });

  it("uses day numbers, never calendar dates", () => {
    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(out).not.toHaveProperty("exportedOn");
  });

  it("summarises the pilot metrics", () => {
    expect(out.summary).toEqual({
      activeDays: 4, // days 1, 5, 7, 12
      activeDaysByWeek: { "1": 3, "2": 1 },
      confirmedCount: 3,
      fromSentenceCount: 3, // 2 sentence transactions + 1 sentence rule
      sentenceUncorrectedCount: 2,
      correctionsByField: { category: 1 },
      paidOccurrenceCount: 1,
      deletedCount: 1,
      editedAfterSaveCount: 1,
    });
  });

  it("sample rows are exported but never counted as the user's activity", () => {
    const sample = toResearchExport(buildSampleState("2026-10-10", "2026-10-10T03:00:00.000Z"), { today: "2026-10-10", localDateOf });
    expect(sample.isSample).toBe(true);
    expect(sample.summary.activeDays).toBe(0);
    expect(sample.summary.confirmedCount).toBe(0);
    expect(JSON.stringify(sample)).not.toContain("sample-");
    expect(JSON.stringify(sample)).not.toContain("กาแฟ");
  });
});
