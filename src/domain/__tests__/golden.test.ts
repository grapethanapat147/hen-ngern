// Golden Cases G1–G12 — docs/02-domain-rules.md §9. Never edit expected values to make a test pass.
import { describe, expect, it } from "vitest";
import { cycleFor } from "../cycle";
import { formatMoney, toThbMinor } from "../money";
import { listOccurrences, occurrenceDates, trialInfo } from "../recurrence";
import { cycleTotals, sideIncomeProgress } from "../totals";
import { actualVsExpectedDiffMinor } from "../matching";
import type { Transaction } from "../types";
import { rule, settings, tx } from "./fixtures";

const TODAY = "2026-10-01";
const OCT = cycleFor(TODAY, 1);

describe("G1 — transfers and card payments are not double counted", () => {
  const txs = [
    tx({ kind: "income", date: TODAY, baht: 8000, accountId: "kbank", categoryId: "side" }),
    tx({ id: "taxi", kind: "expense", date: TODAY, baht: 220, accountId: "cash", categoryId: "transport" }),
    tx({ kind: "transfer", date: TODAY, baht: 5000, fromAccountId: "kbank", toAccountId: "scb" }),
    tx({ kind: "expense", date: TODAY, baht: 399, accountId: "ktc", categoryId: "software" }),
    tx({ kind: "transfer", date: TODAY, baht: 399, fromAccountId: "kbank", toAccountId: "ktc" }),
  ];

  it("counts only income and expense", () => {
    const t = cycleTotals({ transactions: txs, rules: [], settings: settings(), cycle: OCT, today: TODAY });
    expect(t.actualIncomeMinor).toBe(800_000);
    expect(t.actualExpenseMinor).toBe(61_900);
    expect(t.netMinor).toBe(738_100);
  });

  it("G1b — a refund lowers actual expense and stays its own row", () => {
    const withRefund = [
      ...txs,
      tx({ kind: "refund", date: TODAY, baht: 50, accountId: "cash", refundOfId: "taxi" }),
    ];
    const t = cycleTotals({ transactions: withRefund, rules: [], settings: settings(), cycle: OCT, today: TODAY });
    expect(t.actualExpenseMinor).toBe(56_900);
    expect(t.netMinor).toBe(743_100);
    expect(withRefund.filter((x) => !x.deletedAt)).toHaveLength(6);
  });
});

describe("G2 — an expected bill becomes actual exactly once", () => {
  const netflix = rule({ name: "Netflix", baht: 419, cadence: "month", startsOn: "2026-09-05", categoryId: "entertainment" });

  it("before paying: expected 419, actual 0", () => {
    const t = cycleTotals({ transactions: [], rules: [netflix], settings: settings(), cycle: OCT, today: TODAY });
    expect(t.expectedExpenseMinor).toBe(41_900);
    expect(t.actualExpenseMinor).toBe(0);
    const [occ] = listOccurrences([netflix], OCT.start, OCT.end, { today: TODAY, cycleStartDay: 1, transactions: [], settings: settings() });
    expect(occ).toMatchObject({ date: "2026-10-05", status: "upcoming" });
  });

  it("after marking paid: expected 0, actual 419", () => {
    const paid = tx({ kind: "expense", date: "2026-10-05", baht: 419, recurringRuleId: netflix.id, occurrenceDate: "2026-10-05" });
    const t = cycleTotals({ transactions: [paid], rules: [netflix], settings: settings(), cycle: OCT, today: TODAY });
    expect(t.expectedExpenseMinor).toBe(0);
    expect(t.actualExpenseMinor).toBe(41_900);
  });
});

describe("G3 — actual differs from expected", () => {
  it("counts the actual amount once and reports +30", () => {
    const tool = rule({ baht: 399, cadence: "month", startsOn: "2026-10-05" });
    const paid = tx({ kind: "expense", date: "2026-10-05", baht: 429, recurringRuleId: tool.id, occurrenceDate: "2026-10-05" });
    const t = cycleTotals({ transactions: [paid], rules: [tool], settings: settings(), cycle: OCT, today: TODAY });
    expect(t.actualExpenseMinor).toBe(42_900);
    expect(t.expectedExpenseMinor).toBe(0);
    expect(actualVsExpectedDiffMinor(tool, paid, settings())).toBe(3_000);
  });
});

describe("G4 — trial", () => {
  const perplexity = rule({
    name: "Perplexity",
    amountMinor: 2_000,
    currency: "USD",
    cadence: "month",
    trialEndsOn: "2026-10-02",
    startsOn: "2026-10-02",
    categoryId: "software",
  });

  it("September cycle: nothing expected yet, 7 days left, ≈ ฿665", () => {
    const today = "2026-09-25";
    const sep = cycleFor(today, 1);
    const t = cycleTotals({ transactions: [], rules: [perplexity], settings: settings(), cycle: sep, today });
    expect(t.expectedExpenseMinor).toBe(0);
    const trial = trialInfo(perplexity, today, settings());
    expect(trial).toMatchObject({ daysLeft: 7, firstChargeOn: "2026-10-02", chargeThbMinor: 66_500 });
    expect(formatMoney(trial!.chargeThbMinor!, "THB")).toBe("฿665");
  });

  it("October cycle: the first charge is upcoming ≈ ฿665", () => {
    const t = cycleTotals({ transactions: [], rules: [perplexity], settings: settings(), cycle: OCT, today: TODAY });
    expect(t.expectedExpenseMinor).toBe(66_500);
  });
});

describe("G5 — month-end anchor", () => {
  it("keeps the 31st and clamps short months", () => {
    const r = rule({ cadence: "month", startsOn: "2026-01-31" });
    expect(occurrenceDates(r, "2026-02-01", "2026-05-31")).toEqual([
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
    ]);
  });
});

describe("G6 — ends after N or on a date", () => {
  const expected = ["2026-07-10", "2026-08-10", "2026-09-10"];
  it("maxOccurrences 3", () => {
    const r = rule({ cadence: "month", startsOn: "2026-07-10", maxOccurrences: 3 });
    expect(occurrenceDates(r, "2026-01-01", "2026-12-31")).toEqual(expected);
    expect(occurrenceDates(r, OCT.start, OCT.end)).toEqual([]);
  });
  it("endsOn 2026-09-30", () => {
    const r = rule({ cadence: "month", startsOn: "2026-07-10", endsOn: "2026-09-30" });
    expect(occurrenceDates(r, "2026-01-01", "2026-12-31")).toEqual(expected);
    expect(occurrenceDates(r, OCT.start, OCT.end)).toEqual([]);
  });
});

describe("G7 — cycle starting on the 25th", () => {
  it("on the start day", () => {
    expect(cycleFor("2026-09-25", 25)).toEqual({ start: "2026-09-25", end: "2026-10-24" });
  });
  it("the day before", () => {
    expect(cycleFor("2026-09-24", 25)).toEqual({ start: "2026-08-25", end: "2026-09-24" });
  });
});

describe("G8 — FX is locked at confirm time", () => {
  it("changing the rate moves only expected amounts", () => {
    const usd = tx({ kind: "expense", date: TODAY, amountMinor: 2_000, currency: "USD", fxRateToThb: 33.25 });
    const r = rule({ amountMinor: 2_000, currency: "USD", cadence: "month", startsOn: "2026-10-20" });
    const before = cycleTotals({ transactions: [usd], rules: [r], settings: settings(), cycle: OCT, today: TODAY });
    expect(before.actualExpenseMinor).toBe(66_500);
    const after = cycleTotals({ transactions: [usd], rules: [r], settings: settings({ fx: { USD: 34, EUR: 36.4 } }), cycle: OCT, today: TODAY });
    expect(after.actualExpenseMinor).toBe(66_500);
    expect(after.expectedExpenseMinor).toBe(68_000);
  });
});

describe("G9 — side income over goal", () => {
  it("125%, full bar, over by ฿2,500", () => {
    const txs = [
      tx({ kind: "income", date: TODAY, baht: 4500, categoryId: "side" }),
      tx({ kind: "income", date: TODAY, baht: 8000, categoryId: "side" }),
    ];
    const t = cycleTotals({ transactions: txs, rules: [], settings: settings(), cycle: OCT, today: TODAY });
    expect(t.sideIncomeMinor).toBe(1_250_000);
    const p = sideIncomeProgress(t.sideIncomeMinor, 1_000_000);
    expect(p.percent).toBe(125);
    expect(p.barFraction).toBe(1);
    expect(p.label).toBe("เกินเป้า ฿2,500");
  });
});

describe("G10 — weekly", () => {
  it("5 occurrences in October", () => {
    const r = rule({ cadence: "week", startsOn: "2026-10-01" });
    expect(occurrenceDates(r, OCT.start, OCT.end)).toEqual([
      "2026-10-01",
      "2026-10-08",
      "2026-10-15",
      "2026-10-22",
      "2026-10-29",
    ]);
  });
});

describe("G11 — round per transaction, then sum", () => {
  it("3 × US$0.10 at 33.25 = ฿9.99", () => {
    expect(toThbMinor(10, 33.25)).toBe(333);
    const txs = [1, 2, 3].map(() =>
      tx({ kind: "expense", date: TODAY, amountMinor: 10, currency: "USD", fxRateToThb: 33.25 }),
    );
    const t = cycleTotals({ transactions: txs, rules: [], settings: settings(), cycle: OCT, today: TODAY });
    expect(t.actualExpenseMinor).toBe(999);
  });
});

describe("G12 — delete and undo", () => {
  const r = rule({ baht: 419, cadence: "month", startsOn: "2026-10-05" });
  const paid = tx({ kind: "expense", date: "2026-10-05", baht: 419, recurringRuleId: r.id, occurrenceDate: "2026-10-05" });
  const taxi = tx({ kind: "expense", date: TODAY, baht: 220 });
  const run = (transactions: Transaction[]) =>
    cycleTotals({ transactions, rules: [r], settings: settings(), cycle: OCT, today: TODAY });

  it("deleting lowers actual; undo restores it", () => {
    const base = run([paid, taxi]).actualExpenseMinor;
    const deleted = { ...taxi, deletedAt: "2026-10-01T10:00:00.000Z" };
    expect(run([paid, deleted]).actualExpenseMinor).toBe(base - 22_000);
    const restored = { ...deleted, deletedAt: undefined };
    expect(run([paid, restored]).actualExpenseMinor).toBe(base);
  });

  it("a matched occurrence goes back to upcoming when its transaction is deleted", () => {
    const deleted = { ...paid, deletedAt: "2026-10-01T10:00:00.000Z" };
    const ctx = { today: TODAY, cycleStartDay: 1, settings: settings() };
    expect(listOccurrences([r], OCT.start, OCT.end, { ...ctx, transactions: [paid] })[0].status).toBe("matched");
    expect(listOccurrences([r], OCT.start, OCT.end, { ...ctx, transactions: [deleted] })[0].status).toBe("upcoming");
    expect(run([deleted]).expectedExpenseMinor).toBe(41_900);
  });
});
