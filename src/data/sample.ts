import { cycleFor } from "@/domain/cycle";
import { addDays, addMonths, maxDate, parseLocalDate } from "@/domain/dates";
import { DEFAULT_SETTINGS, type AppState, type LocalDate, type RecurringRule, type Transaction } from "@/domain/types";

// Sample book shown on first open. Every row is labelled; none of it is real money (CLAUDE.md "Locked").

export const SAMPLE_NOTE = "ตัวอย่าง ไม่ใช่ยอดจริง";

/**
 * Builds a sample book whose dates sit in the cycle containing `today`:
 * actual rows are never after today, some bills are already paid, others are still upcoming,
 * and one trial ends in 7 days.
 */
export function buildSampleState(today: LocalDate, nowIso: string): AppState {
  const cycle = cycleFor(today, DEFAULT_SETTINGS.cycleStartDay);
  /** n days ago, but not before this cycle — actual rows must stay in the current cycle and never in the future. */
  const ago = (n: number) => maxDate(cycle.start, addDays(today, -n));
  const ahead = (n: number) => addDays(today, n);
  /** A monthly anchor a few months back with the same day, so the rule has history; days > 28 start this month to avoid clamping drift. */
  const monthlyStart = (date: LocalDate) => (parseLocalDate(date).d <= 28 ? addMonths(date, -3) : date);

  const stamp = { createdAt: nowIso, updatedAt: nowIso };
  const t = (id: string, fields: Omit<Transaction, "id" | "createdAt" | "updatedAt" | "status" | "source" | "note" | "scope" | "fxRateToThb" | "currency"> & Partial<Pick<Transaction, "currency" | "fxRateToThb" | "scope">>): Transaction => ({
    id: `sample-tx-${id}`,
    currency: "THB",
    fxRateToThb: 1,
    scope: "personal",
    source: "sample",
    status: "confirmed",
    note: SAMPLE_NOTE,
    ...stamp,
    ...fields,
  });
  const r = (id: string, fields: Omit<RecurringRule, "id" | "createdAt" | "updatedAt" | "note" | "scope" | "currency"> & Partial<Pick<RecurringRule, "currency" | "scope">>): RecurringRule => ({
    id: `sample-rule-${id}`,
    currency: "THB",
    scope: "personal",
    note: SAMPLE_NOTE,
    ...stamp,
    ...fields,
  });

  const usd = DEFAULT_SETTINGS.fx.USD;

  // Bills already paid this cycle (matched) and still to come (upcoming).
  const paid = {
    netflix: ago(6),
    rent: ago(8),
    claude: ago(4),
    spotify: ago(2),
  };
  const due = {
    youtube: ahead(3),
    chatgpt: ahead(5),
    notion: ahead(9),
    googleOne: ahead(12),
    fitness: ahead(15),
    partTime: ahead(10),
  };

  const rules: RecurringRule[] = [
    r("netflix", { kind: "expense", name: "Netflix", amountMinor: 41_900, cadence: "month", startsOn: monthlyStart(paid.netflix), categoryId: "entertainment", accountId: "sample-kbank" }),
    r("rent", { kind: "expense", name: "ค่าเช่าห้อง", amountMinor: 650_000, cadence: "month", startsOn: monthlyStart(paid.rent), categoryId: "home", accountId: "sample-scb" }),
    r("claude", { kind: "expense", name: "Claude Pro", amountMinor: 2_000, currency: "USD", cadence: "month", startsOn: monthlyStart(paid.claude), categoryId: "software", accountId: "sample-kbank" }),
    r("spotify", { kind: "expense", name: "Spotify", amountMinor: 13_900, cadence: "month", startsOn: monthlyStart(paid.spotify), categoryId: "music", accountId: "sample-tmn" }),
    r("youtube", { kind: "expense", name: "YouTube Premium", amountMinor: 17_900, cadence: "month", startsOn: monthlyStart(due.youtube), categoryId: "entertainment", accountId: "sample-kbank" }),
    r("chatgpt", { kind: "expense", name: "ChatGPT Plus", amountMinor: 2_000, currency: "USD", cadence: "month", startsOn: monthlyStart(due.chatgpt), categoryId: "software", accountId: "sample-ktc" }),
    r("notion", { kind: "expense", name: "Notion", amountMinor: 1_000, currency: "USD", cadence: "month", startsOn: monthlyStart(due.notion), categoryId: "software", accountId: "sample-ktc" }),
    r("google-one", { kind: "expense", name: "Google One", amountMinor: 99_000, cadence: "year", startsOn: addMonths(due.googleOne, -12), categoryId: "cloud", accountId: "sample-kbank" }),
    r("fitness", { kind: "expense", name: "ฟิตเนส", amountMinor: 150_000, cadence: "month", startsOn: monthlyStart(due.fitness), categoryId: "health", accountId: "sample-scb" }),
    r("perplexity", { kind: "expense", name: "Perplexity Pro", amountMinor: 2_000, currency: "USD", cadence: "month", startsOn: ahead(7), trialEndsOn: ahead(7), categoryId: "software", accountId: "sample-kbank" }),
    r("part-time", { kind: "income", name: "งานพาร์ตไทม์", amountMinor: 800_000, cadence: "month", startsOn: monthlyStart(due.partTime), categoryId: "side", accountId: "sample-scb" }),
  ];

  const payOf = (ruleId: string, date: LocalDate, fields: Partial<Transaction> = {}): Transaction => {
    const rule = rules.find((x) => x.id === `sample-rule-${ruleId}`)!;
    return t(`paid-${ruleId}`, {
      kind: rule.kind,
      name: rule.name,
      amountMinor: rule.amountMinor,
      currency: rule.currency,
      fxRateToThb: rule.currency === "USD" ? usd : 1,
      date,
      categoryId: rule.categoryId,
      accountId: rule.accountId,
      recurringRuleId: rule.id,
      occurrenceDate: date,
      ...fields,
    });
  };

  const transactions: Transaction[] = [
    t("salary", { kind: "income", name: "เงินเดือน", amountMinor: 4_500_000, date: ago(10), categoryId: "salary", accountId: "sample-scb" }),
    t("side", { kind: "income", name: "ค่างานออกแบบ", amountMinor: 450_000, date: ago(5), categoryId: "side", accountId: "sample-scb" }),
    payOf("netflix", paid.netflix),
    payOf("rent", paid.rent),
    payOf("claude", paid.claude),
    // Spotify charged a little more than expected, to show the diff.
    payOf("spotify", paid.spotify, { amountMinor: 14_900 }),
    t("coffee", { kind: "expense", name: "กาแฟ", amountMinor: 6_500, date: ago(1), categoryId: "food", accountId: "sample-tmn" }),
    t("lunch", { kind: "expense", name: "ข้าวมันไก่", amountMinor: 5_000, date: ago(1), categoryId: "food", accountId: "sample-cash" }),
    t("grabfood", { kind: "expense", name: "Grab Food", amountMinor: 18_900, date: ago(3), categoryId: "food", accountId: "sample-kbank" }),
    t("bts", { kind: "expense", name: "BTS", amountMinor: 4_700, date: ago(3), categoryId: "transport", accountId: "sample-tmn" }),
    t("taxi", { kind: "expense", name: "แท็กซี่", amountMinor: 22_000, date: ago(7), categoryId: "transport", accountId: "sample-cash" }),
    t("mookata", { kind: "expense", name: "หมูกระทะ", amountMinor: 45_000, date: ago(9), categoryId: "food", accountId: "sample-kbank" }),
    t("pharmacy", { kind: "expense", name: "ร้านยา", amountMinor: 12_000, date: ago(11), categoryId: "health", accountId: "sample-cash" }),
    t("gas", { kind: "expense", name: "น้ำมัน", amountMinor: 80_000, date: ago(12), categoryId: "transport", accountId: "sample-ktc" }),
    t("refund-grab", { kind: "refund", name: "คืนเงิน Grab Food", amountMinor: 5_000, date: ago(2), categoryId: "food", accountId: "sample-kbank", refundOfId: "sample-tx-grabfood" }),
    t("card-payment", { kind: "transfer", name: "จ่ายยอดบัตร KTC", amountMinor: 80_000, date: ago(1), fromAccountId: "sample-scb", toAccountId: "sample-ktc" }),
  ];

  return {
    schemaVersion: 1,
    isSample: true,
    settings: { ...DEFAULT_SETTINGS, fx: { ...DEFAULT_SETTINGS.fx } },
    accounts: [
      { id: "sample-kbank", name: "KBank Visa", type: "credit_card", last4: "4529", color: "#0B6B66" },
      { id: "sample-ktc", name: "KTC", type: "credit_card", last4: "8812", color: "#243044" },
      { id: "sample-scb", name: "SCB", type: "bank", color: "#3D6B4F" },
      { id: "sample-tmn", name: "TrueMoney", type: "wallet", last4: "7127", color: "#C24B3A" },
      { id: "sample-cash", name: "เงินสด", type: "cash" },
    ],
    transactions,
    rules,
  };
}
