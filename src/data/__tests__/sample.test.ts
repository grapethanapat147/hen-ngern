import { describe, expect, it } from "vitest";
import { cycleFor } from "@/domain/cycle";
import { listOccurrences, trialInfo } from "@/domain/recurrence";
import { cycleTotals } from "@/domain/totals";
import { appStateSchema } from "../schema";
import { buildSampleState, SAMPLE_NOTE } from "../sample";

const NOW = "2026-10-15T03:00:00.000Z";
// Edge days: first of month, mid-month, 31st, end of February, leap day.
const TODAYS = ["2026-10-01", "2026-10-15", "2026-10-31", "2026-02-28", "2028-02-29", "2026-12-30"];

describe.each(TODAYS)("sample book for today = %s", (today) => {
  const state = buildSampleState(today, NOW);
  const cycle = cycleFor(today, state.settings.cycleStartDay);
  const ctx = { today, cycleStartDay: 1, transactions: state.transactions, settings: state.settings };

  it("passes the storage schema", () => {
    expect(appStateSchema.safeParse(state).success).toBe(true);
  });

  it("is flagged and every row is labelled as sample", () => {
    expect(state.isSample).toBe(true);
    for (const t of state.transactions) {
      expect(t.source).toBe("sample");
      expect(t.note).toBe(SAMPLE_NOTE);
    }
    for (const r of state.rules) expect(r.note).toBe(SAMPLE_NOTE);
  });

  it("has no actual money in the future and all of it in this cycle", () => {
    for (const t of state.transactions) {
      expect(t.date <= today).toBe(true);
      expect(t.date >= cycle.start).toBe(true);
    }
  });

  it("every paid bill is linked to a real occurrence of its rule", () => {
    const occurrences = listOccurrences(state.rules, cycle.start, cycle.end, ctx);
    const linked = state.transactions.filter((t) => t.recurringRuleId);
    expect(linked.length).toBeGreaterThanOrEqual(3);
    for (const t of linked) {
      const occ = occurrences.find((o) => o.ruleId === t.recurringRuleId && o.date === t.occurrenceDate);
      expect(occ?.status).toBe("matched");
    }
  });

  it("covers transfer, refund, trial, USD and expected income", () => {
    expect(state.transactions.some((t) => t.kind === "transfer")).toBe(true);
    const refund = state.transactions.find((t) => t.kind === "refund");
    expect(state.transactions.some((t) => t.id === refund?.refundOfId)).toBe(true);
    const trial = state.rules.map((r) => trialInfo(r, today, state.settings)).find(Boolean);
    expect(trial?.daysLeft).toBe(7);
    expect(state.transactions.some((t) => t.currency === "USD")).toBe(true);
    expect(state.rules.some((r) => r.kind === "income")).toBe(true);
  });

  it("totals are consistent", () => {
    const t = cycleTotals({ ...state, cycle, today });
    expect(t.actualIncomeMinor).toBe(4_950_000);
    expect(t.netMinor).toBe(t.actualIncomeMinor - t.actualExpenseMinor);
    expect(t.actualExpenseMinor).toBeGreaterThan(0);
  });
});

describe("sample book mid-month", () => {
  it("has upcoming bills inside the current cycle", () => {
    const today = "2026-10-10";
    const state = buildSampleState(today, NOW);
    const cycle = cycleFor(today, 1);
    const t = cycleTotals({ ...state, cycle, today });
    expect(t.expectedExpenseMinor).toBeGreaterThan(0);
    expect(t.expectedIncomeMinor).toBe(800_000);
  });
});
