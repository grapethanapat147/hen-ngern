import { describe, expect, it } from "vitest";
import { calendarMonth, monthGrid } from "../calendar";
import { csvCell, CSV_HEADER, transactionsToCsv } from "../csv";
import { DEFAULT_SETTINGS, type AppState } from "../types";
import { rule, settings, tx } from "./fixtures";

describe("monthGrid", () => {
  it("October 2026 starts on Thursday, Sunday-first weeks", () => {
    const weeks = monthGrid(2026, 10);
    expect(weeks[0]).toEqual([null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
  it("February in a leap year", () => {
    expect(monthGrid(2028, 2).flat().filter(Boolean)).toHaveLength(29);
  });
});

describe("calendarMonth (A-16)", () => {
  const netflix = rule({ id: "nf", name: "Netflix", baht: 419, cadence: "month", startsOn: "2026-09-05" });
  const rent = rule({ id: "rent", name: "ค่าเช่า", baht: 6500, cadence: "month", startsOn: "2026-09-01" });
  const skipped = rule({ id: "sk", name: "Gym", baht: 1500, cadence: "month", startsOn: "2026-09-20", skippedDates: ["2026-10-20"] });
  const pay = rule({ id: "pay", kind: "income", name: "พาร์ตไทม์", baht: 8000, cadence: "month", startsOn: "2026-09-28", categoryId: "side" });
  const txs = [
    tx({ id: "paidRent", kind: "expense", date: "2026-10-01", baht: 6500, recurringRuleId: "rent", occurrenceDate: "2026-10-01" }),
    tx({ id: "coffee", kind: "expense", date: "2026-10-03", baht: 65 }),
    tx({ id: "refund", kind: "refund", date: "2026-10-03", baht: 15 }),
    tx({ id: "move", kind: "transfer", date: "2026-10-03", baht: 9999, fromAccountId: "a", toAccountId: "b" }),
    tx({ id: "gone", kind: "expense", date: "2026-10-04", baht: 99999, deletedAt: "x" }),
  ];
  const m = calendarMonth(2026, 10, { transactions: txs, rules: [netflix, rent, skipped, pay], settings: settings(), today: "2026-10-10" });

  it("keeps actual and expected apart; matched occurrences are not repeated as expected", () => {
    expect(m.days.get("2026-10-01")!.actual.map((t) => t.id)).toEqual(["paidRent"]);
    expect(m.days.get("2026-10-01")!.expected).toEqual([]);
    expect(m.days.get("2026-10-05")!.expected.map((o) => [o.name, o.status])).toEqual([["Netflix", "overdue"]]);
    expect(m.days.get("2026-10-28")!.expected.map((o) => o.kind)).toEqual(["income"]);
    expect(m.days.get("2026-10-20")!.expected).toEqual([]); // skipped
  });

  it("summary: actual spend (transfers out, refunds netted), charge count, heaviest day", () => {
    expect(m.actualSpendMinor).toBe(650_000 + 6_500 - 1_500);
    expect(m.chargeCount).toBe(2); // rent + Netflix; skipped gym excluded, income excluded
    expect(m.heaviestDay).toBe("2026-10-01");
    expect(m.days.get("2026-10-03")!.spentMinor).toBe(5_000);
  });
});

describe("CSV export (A-21)", () => {
  const state: AppState = {
    schemaVersion: 1,
    isSample: false,
    settings: DEFAULT_SETTINGS,
    accounts: [{ id: "kbank", name: "KBank Visa", type: "credit_card", last4: "4529" }],
    rules: [rule({ id: "r", name: "Claude Pro", cadence: "month", startsOn: "2026-10-01" })],
    transactions: [
      tx({ kind: "expense", name: "ข้าว, ไข่ \"ดาว\"", date: "2026-10-02", baht: 50, categoryId: "food", accountId: "kbank" }),
      tx({ kind: "expense", name: "Claude", date: "2026-10-01", amountMinor: 2_000, currency: "USD", fxRateToThb: 33.25, recurringRuleId: "r", occurrenceDate: "2026-10-01", categoryId: "software" }),
      tx({ kind: "income", name: "=HYPERLINK(\"x\")", date: "2026-10-03", baht: 1, scope: "work" }),
      tx({ kind: "expense", name: "ลบแล้ว", date: "2026-10-03", baht: 1, deletedAt: "x" }),
    ],
  };
  const csv = transactionsToCsv(state);
  const lines = csv.slice(1).trimEnd().split("\r\n");

  it("starts with a UTF-8 BOM, uses CRLF, has a Thai header", () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines[0]).toBe(CSV_HEADER.join(","));
    expect(lines).toHaveLength(4); // header + 3 live rows
  });

  it("rows are dated ascending with locked-rate baht", () => {
    expect(lines[1]).toBe("2026-10-01,รายจ่าย,Claude,20.00,USD,33.25,665.00,งาน/ซอฟต์แวร์,,,,ส่วนตัว,Claude Pro,,manual");
    expect(lines[2]).toBe('2026-10-02,รายจ่าย,"ข้าว, ไข่ ""ดาว""",50.00,THB,1,50.00,อาหาร,KBank Visa,,,ส่วนตัว,,,manual');
  });

  it("neutralises formulas", () => {
    expect(lines[3]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell("@sum")).toBe("'@sum");
  });
});
