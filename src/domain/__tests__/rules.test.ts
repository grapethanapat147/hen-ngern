import { describe, expect, it } from "vitest";
import { cycleFor } from "../cycle";
import { listOccurrences } from "../recurrence";
import { editRuleFromNext, isRuleActive, recurringSummary, resumeRule, ruleIssues, stopRule } from "../rules";
import { cycleTotals } from "../totals";
import { rule, settings, tx } from "./fixtures";

const TODAY = "2026-10-10";
let n = 0;
const opts = (transactions = [] as ReturnType<typeof tx>[]) => ({ newId: () => `new${++n}`, nowIso: "now", transactions });

describe("recurring summary", () => {
  it("splits out/in, yearly exact, monthly = yearly ÷ 12", () => {
    const rules = [
      rule({ baht: 419, cadence: "month", startsOn: "2026-09-05" }),
      rule({ baht: 1188, cadence: "year", startsOn: "2026-03-01" }),
      rule({ amountMinor: 2_000, currency: "USD", cadence: "month", startsOn: "2026-09-20" }),
      rule({ kind: "income", baht: 8000, cadence: "month", startsOn: "2026-09-28", categoryId: "side" }),
      rule({ baht: 100, cadence: "month", startsOn: "2026-01-01", endsOn: "2026-09-30" }), // ended
      rule({ baht: 100, cadence: "month", startsOn: "2026-01-01", deletedAt: "x" }), // deleted
    ];
    const s = recurringSummary(rules, settings(), TODAY);
    expect(s.activeCount).toBe(4);
    expect(s.expense.yearlyMinor).toBe(41_900 * 12 + 118_800 + 66_500 * 12);
    expect(s.expense.monthlyMinor).toBe(41_900 + 9_900 + 66_500);
    expect(s.income).toEqual({ monthlyMinor: 800_000, yearlyMinor: 9_600_000 });
  });

  it("a rule whose last occurrence is past is not active", () => {
    expect(isRuleActive(rule({ cadence: "month", startsOn: "2026-07-10", maxOccurrences: 3 }), TODAY)).toBe(false);
    expect(isRuleActive(rule({ cadence: "month", startsOn: "2026-07-10", maxOccurrences: 4 }), TODAY)).toBe(true);
  });
});

describe("ruleIssues", () => {
  const base = { name: "Netflix", amountMinor: 41_900, startsOn: "2026-10-05", kind: "expense" as const };
  it("accepts a valid rule and lists what is wrong otherwise", () => {
    expect(ruleIssues(base)).toEqual([]);
    expect(ruleIssues({ ...base, name: " ", amountMinor: 0 })).toEqual(["ใส่ชื่อรายการ", "ยอดต้องมากกว่า 0"]);
    expect(ruleIssues({ ...base, endsOn: "2026-10-01" })).toContain("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
    expect(ruleIssues({ ...base, trialEndsOn: "2026-10-06" })).toContain("วันหมดช่วงทดลองต้องไม่เกินวันเริ่มหัก");
    expect(ruleIssues({ ...base, maxOccurrences: 0 })).toContain("จำนวนครั้งต้องเป็นจำนวนเต็มบวก");
  });
});

describe("edit from the next time on", () => {
  const netflix = rule({ id: "nf", name: "Netflix", baht: 419, cadence: "month", startsOn: "2026-07-04" });
  const paidOct = tx({ kind: "expense", date: "2026-10-04", baht: 419, recurringRuleId: "nf", occurrenceDate: "2026-10-04" });

  it("keeps the past at the old price and carries the new price forward", () => {
    const edited = { ...netflix, amountMinor: 45_900 };
    const r = editRuleFromNext(netflix, edited, TODAY, opts([paidOct]));
    const [ended, next] = r.rules;
    expect(ended).toMatchObject({ id: "nf", endsOn: "2026-10-09", amountMinor: 41_900, supersededBy: next.id });
    expect(next).toMatchObject({ amountMinor: 45_900, startsOn: "2026-11-04" });
    expect(r.transactions).toEqual([]); // paid date is before today, stays on the old rule
    // Past occurrences keep the old amount; the future uses the new one.
    const occ = listOccurrences(r.rules, "2026-09-01", "2026-11-30", { today: TODAY, cycleStartDay: 1, transactions: [paidOct], settings: settings() });
    expect(occ.map((o) => [o.date, o.amountMinor, o.status])).toEqual([
      ["2026-09-04", 41_900, "past"],
      ["2026-10-04", 41_900, "matched"],
      ["2026-11-04", 45_900, "upcoming"],
    ]);
  });

  it("a bill already paid for a future date moves to the new rule — no double counting", () => {
    const paidEarly = tx({ kind: "expense", date: "2026-10-10", baht: 419, recurringRuleId: "nf", occurrenceDate: "2026-11-04" });
    const r = editRuleFromNext(netflix, { ...netflix, amountMinor: 45_900 }, TODAY, opts([paidEarly]));
    expect(r.transactions).toHaveLength(1);
    const moved = r.transactions[0];
    expect(moved.recurringRuleId).toBe(r.newRules[0].id);
    const nov = cycleFor("2026-11-01", 1);
    const t = cycleTotals({ transactions: [moved], rules: r.rules, settings: settings(), cycle: nov, today: TODAY });
    expect(t.expectedExpenseMinor).toBe(0);
  });

  it("a rule with no history is edited in place", () => {
    const future = rule({ id: "f", cadence: "month", startsOn: "2026-10-20", baht: 100 });
    const r = editRuleFromNext(future, { ...future, amountMinor: 20_000 }, TODAY, opts());
    expect(r.rules).toEqual([expect.objectContaining({ id: "f", amountMinor: 20_000 })]);
    expect(r.newRules).toEqual([]);
  });

  it("maxOccurrences counts what already happened", () => {
    const limited = rule({ id: "l", cadence: "month", startsOn: "2026-08-15", maxOccurrences: 6, baht: 100 });
    const r = editRuleFromNext(limited, { ...limited, amountMinor: 20_000 }, TODAY, opts());
    // Aug 15 and Sep 15 happened → 4 left starting Oct 15.
    expect(r.newRules[0]).toMatchObject({ startsOn: "2026-10-15", maxOccurrences: 4 });
  });

  it("a changed day of month re-anchors the continuation", () => {
    const r = editRuleFromNext(netflix, { ...netflix, startsOn: "2026-07-20" }, TODAY, opts());
    expect(r.newRules[0].startsOn).toBe("2026-10-20");
  });

  it("ending before the next date just ends the rule", () => {
    const r = editRuleFromNext(netflix, { ...netflix, endsOn: "2026-10-31" }, TODAY, opts());
    expect(r.newRules).toEqual([]);
    expect(r.rules[0].endsOn).toBe("2026-10-09");
  });
});

describe("stop and resume", () => {
  it("A-15 เลิกใช้ ends today and resume brings it back", () => {
    const r = rule({ cadence: "month", startsOn: "2026-07-20", baht: 100 });
    const stopped = stopRule(r, TODAY, "now");
    expect(stopped.endsOn).toBe(TODAY);
    expect(isRuleActive(stopped, TODAY)).toBe(false);
    expect(isRuleActive(resumeRule(stopped, "now"), TODAY)).toBe(true);
  });
});
