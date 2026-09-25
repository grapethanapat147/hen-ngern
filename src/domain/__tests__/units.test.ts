// Unit tests for building blocks beyond the Golden Cases.
import { describe, expect, it } from "vitest";
import { cycleFor, cycleLabel, shiftCycle } from "../cycle";
import { addDays, addMonths, dayOfWeek, diffDays, formatThaiShort, isLocalDate, todayLocal } from "../dates";
import { bookInsights, recurringMonthlyExpense } from "../insights";
import { namesOverlap, suggestMatches, unmatch } from "../matching";
import { formatMoney, formatSignedThb, parseAmountToMinor, toThbMinor } from "../money";
import { listOccurrences, trialInfo } from "../recurrence";
import { accountBreakdown, categoryBreakdown, cycleTotals, sideIncomeProgress } from "../totals";
import { rule, settings, tx } from "./fixtures";

const TODAY = "2026-10-01";
const OCT = cycleFor(TODAY, 1);

describe("money", () => {
  it("parses user input without float math", () => {
    expect(parseAmountToMinor("1,234.5")).toBe(123_450);
    expect(parseAmountToMinor("0.1")).toBe(10);
    expect(parseAmountToMinor("65")).toBe(6_500);
    expect(parseAmountToMinor("1.234")).toBeNull();
    expect(parseAmountToMinor("-5")).toBeNull();
    expect(parseAmountToMinor("abc")).toBeNull();
  });

  it("rounds half away from zero", () => {
    expect(toThbMinor(10, 33.25)).toBe(333);
    expect(toThbMinor(-10, 33.25)).toBe(-333);
    expect(toThbMinor(999, 36.4)).toBe(36_364);
    expect(toThbMinor(123_456, 1)).toBe(123_456);
  });

  it("formats", () => {
    expect(formatMoney(123_400, "THB")).toBe("฿1,234");
    expect(formatMoney(123_450, "THB")).toBe("฿1,234.50");
    expect(formatMoney(2_000, "USD")).toBe("US$20");
    expect(formatMoney(999, "EUR")).toBe("€9.99");
    expect(formatMoney(-3_000, "THB")).toBe("−฿30");
    expect(formatSignedThb(3_000)).toBe("+฿30");
    expect(formatSignedThb(-3_000)).toBe("−฿30");
  });
});

describe("dates", () => {
  it("does calendar math on local dates", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(diffDays("2026-09-25", "2026-10-02")).toBe(7);
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(dayOfWeek("2026-10-01")).toBe(4); // Thursday
    expect(formatThaiShort("2026-10-05")).toBe("5 ต.ค.");
    expect(isLocalDate("2026-02-29")).toBe(false);
    expect(isLocalDate("2028-02-29")).toBe(true);
  });

  it("todayLocal uses the device's local calendar date", () => {
    expect(todayLocal(new Date(2026, 9, 1, 23, 59))).toBe("2026-10-01");
  });
});

describe("cycle", () => {
  it("labels and shifts", () => {
    expect(cycleLabel(OCT, 1)).toBe("ต.ค. 2026");
    const c25 = cycleFor("2026-09-25", 25);
    expect(cycleLabel(c25, 25)).toBe("25 ก.ย. – 24 ต.ค.");
    expect(shiftCycle(c25, 1, 25)).toEqual({ start: "2026-10-25", end: "2026-11-24" });
    expect(shiftCycle(OCT, -1, 1)).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    expect(cycleFor("2026-01-10", 25)).toEqual({ start: "2025-12-25", end: "2026-01-24" });
  });

  it("A-19 — totals follow a cycle starting on the 25th", () => {
    const txs = [
      tx({ kind: "expense", date: "2026-09-24", baht: 100 }),
      tx({ kind: "expense", date: "2026-09-25", baht: 200 }),
    ];
    const cycle = cycleFor("2026-09-30", 25);
    const t = cycleTotals({ transactions: txs, rules: [], settings: settings({ cycleStartDay: 25 }), cycle, today: "2026-09-30" });
    expect(t.actualExpenseMinor).toBe(20_000);
  });
});

describe("occurrence status", () => {
  it("overdue inside the current cycle, past before it", () => {
    const r = rule({ baht: 100, cadence: "month", startsOn: "2026-08-05" });
    const occ = listOccurrences([r], "2026-08-01", "2026-10-31", {
      today: "2026-10-10",
      cycleStartDay: 1,
      transactions: [],
      settings: settings(),
    });
    expect(occ.map((o) => [o.date, o.status])).toEqual([
      ["2026-08-05", "past"],
      ["2026-09-05", "past"],
      ["2026-10-05", "overdue"],
    ]);
  });

  it("overdue is not counted as expected or actual", () => {
    const r = rule({ baht: 100, cadence: "month", startsOn: "2026-10-05" });
    const t = cycleTotals({ transactions: [], rules: [r], settings: settings(), cycle: OCT, today: "2026-10-10" });
    expect(t.expectedExpenseMinor).toBe(0);
    expect(t.actualExpenseMinor).toBe(0);
  });

  it("skipped dates and deleted rules produce nothing", () => {
    const skipped = rule({ baht: 100, cadence: "month", startsOn: "2026-10-05", skippedDates: ["2026-10-05"] });
    const deleted = rule({ baht: 100, cadence: "month", startsOn: "2026-10-05", deletedAt: "x" });
    const t = cycleTotals({ transactions: [], rules: [skipped, deleted], settings: settings(), cycle: OCT, today: TODAY });
    expect(t.expectedExpenseMinor).toBe(0);
  });

  it("expected income is separate from expected expense", () => {
    const pay = rule({ kind: "income", baht: 8000, cadence: "month", startsOn: "2026-10-28", categoryId: "side" });
    const t = cycleTotals({ transactions: [], rules: [pay], settings: settings(), cycle: OCT, today: TODAY });
    expect(t.expectedIncomeMinor).toBe(800_000);
    expect(t.actualIncomeMinor).toBe(0);
    expect(t.sideIncomeMinor).toBe(0);
  });

  it("a missing FX rate is reported, not silently summed", () => {
    const r = rule({ amountMinor: 999, currency: "EUR", cadence: "month", startsOn: "2026-10-20" });
    const t = cycleTotals({ transactions: [], rules: [r], settings: settings({ fx: { USD: 33.25, EUR: 0 } }), cycle: OCT, today: TODAY });
    expect(t.expectedExpenseMinor).toBe(0);
    expect(t.missingFxCount).toBe(1);
  });

  it("a finished trial has no countdown", () => {
    const r = rule({ cadence: "month", startsOn: "2026-09-02", trialEndsOn: "2026-09-02" });
    expect(trialInfo(r, TODAY, settings())).toBeUndefined();
  });
});

describe("scope filter", () => {
  it("applies to every formula", () => {
    const txs = [
      tx({ kind: "income", date: TODAY, baht: 1000, scope: "work", categoryId: "side" }),
      tx({ kind: "expense", date: TODAY, baht: 300, scope: "personal" }),
    ];
    const r = rule({ baht: 50, cadence: "month", startsOn: "2026-10-20", scope: "personal" });
    const work = cycleTotals({ transactions: txs, rules: [r], settings: settings(), cycle: OCT, today: TODAY, scope: "work" });
    expect(work).toMatchObject({ actualIncomeMinor: 100_000, actualExpenseMinor: 0, expectedExpenseMinor: 0 });
  });
});

describe("breakdowns", () => {
  it("refund takes the original category and lowers the account", () => {
    const original = tx({ kind: "expense", date: TODAY, baht: 220, categoryId: "transport", accountId: "cash" });
    const refund = tx({ kind: "refund", date: TODAY, baht: 50, refundOfId: original.id, accountId: "cash" });
    const transfer = tx({ kind: "transfer", date: TODAY, baht: 999, fromAccountId: "cash", toAccountId: "kbank" });
    const slice = { transactions: [original, refund, transfer], cycle: OCT };
    expect(categoryBreakdown(slice)).toEqual([
      { key: "transport", amountMinor: 17_000, count: 2, sourceIds: [original.id, refund.id] },
    ]);
    expect(accountBreakdown(slice)[0]).toMatchObject({ key: "cash", amountMinor: 17_000 });
  });
});

describe("matching", () => {
  const netflix = rule({ name: "Netflix", baht: 419, cadence: "month", startsOn: "2026-09-05" });
  const ctx = { today: TODAY, cycleStartDay: 1, transactions: [], settings: settings() };

  it("A-13 — suggests the nearby unpaid occurrence", () => {
    const [m] = suggestMatches({ kind: "expense", name: "netflix", date: "2026-10-03" }, [netflix], ctx);
    expect(m).toMatchObject({ ruleId: netflix.id, date: "2026-10-05" });
  });

  it("ignores other kinds, far dates and different names", () => {
    expect(suggestMatches({ kind: "income", name: "Netflix", date: "2026-10-05" }, [netflix], ctx)).toEqual([]);
    expect(suggestMatches({ kind: "expense", name: "Netflix", date: "2026-10-09" }, [netflix], ctx)).toEqual([]);
    expect(suggestMatches({ kind: "expense", name: "Spotify", date: "2026-10-05" }, [netflix], ctx)).toEqual([]);
  });

  it("does not suggest an occurrence that is already matched", () => {
    const paid = tx({ kind: "expense", date: "2026-10-05", baht: 419, recurringRuleId: netflix.id, occurrenceDate: "2026-10-05" });
    expect(suggestMatches({ kind: "expense", name: "Netflix", date: "2026-10-05" }, [netflix], { ...ctx, transactions: [paid] })).toEqual([]);
    const unlinked = unmatch(paid);
    expect(unlinked.recurringRuleId).toBeUndefined();
    expect(suggestMatches({ kind: "expense", name: "Netflix", date: "2026-10-05" }, [netflix], { ...ctx, transactions: [unlinked] })).toHaveLength(1);
  });

  it("name overlap works for Thai without spaces", () => {
    expect(namesOverlap("ค่าเช่า", "ค่าเช่าห้อง")).toBe(true);
    expect(namesOverlap("Claude Pro", "claude")).toBe(true);
    expect(namesOverlap("กาแฟ", "ข้าว")).toBe(false);
  });
});

describe("side income progress", () => {
  it("under goal", () => {
    expect(sideIncomeProgress(450_000, 1_000_000)).toMatchObject({ percent: 45, barFraction: 0.45, label: "ขาดอีก ฿5,500" });
  });
});

describe("insights", () => {
  it("only reports what the book can back, with sources", () => {
    const food = tx({ kind: "expense", date: "2026-10-01", baht: 300, categoryId: "food", accountId: "kbank" });
    const taxi = tx({ kind: "expense", date: "2026-10-02", baht: 100, categoryId: "transport", accountId: "cash" });
    const side = tx({ kind: "income", date: "2026-10-01", baht: 4500, categoryId: "side" });
    const icloud = rule({ baht: 1188, cadence: "year", startsOn: "2026-03-01" });
    const netflix = rule({ baht: 419, cadence: "month", startsOn: "2026-03-05" });
    const insights = bookInsights(
      { transactions: [food, taxi, side], rules: [icloud, netflix], settings: settings(), cycle: OCT, today: TODAY },
      [{ id: "kbank", name: "KBank Visa", type: "credit_card" }],
    );
    const byId = Object.fromEntries(insights.map((i) => [i.id, i]));
    expect(byId.top_category).toEqual({ id: "top_category", text: "จ่ายหมวดอาหารมากสุด ฿300 (75% ของจ่ายจริง)", sourceIds: [food.id] });
    expect(byId.heaviest_day.text).toBe("วันที่จ่ายหนักสุด 1 ต.ค. ฿300");
    expect(byId.heaviest_account.text).toBe("บัญชีที่จ่ายมากสุด KBank Visa ฿300");
    expect(byId.side_gap).toMatchObject({ text: "งานเสริมขาดจากเป้าอีก ฿5,500", sourceIds: [side.id] });
    expect(byId.out_over_in).toBeUndefined();
    expect(byId.recurring_monthly).toMatchObject({ text: "บิลซ้ำเฉลี่ยเดือนละ ≈ ฿518", sourceIds: [icloud.id, netflix.id] });
  });

  it("uses the locked wording when out > in", () => {
    const insights = bookInsights(
      { transactions: [tx({ kind: "expense", date: TODAY, baht: 100 })], rules: [], settings: settings(), cycle: OCT, today: TODAY },
      [],
    );
    expect(insights.find((i) => i.id === "out_over_in")?.text).toBe("รอบนี้เงินออกมากกว่าเข้า ลองดูรายการซ้ำที่ยังใช้อยู่");
  });

  it("weekly rules average ×52÷12", () => {
    const weekly = rule({ baht: 120, cadence: "week", startsOn: "2026-10-01" });
    expect(recurringMonthlyExpense({ rules: [weekly], settings: settings(), today: TODAY }).amountMinor).toBe(52_000);
  });
});
