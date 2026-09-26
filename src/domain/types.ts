// Data model — docs/02-domain-rules.md §2 is the source of truth.

export type Currency = "THB" | "USD" | "EUR";
export type TxKind = "income" | "expense" | "transfer" | "refund";
export type Cadence = "week" | "month" | "year";
export type Scope = "personal" | "work";
export type AccountType = "credit_card" | "bank" | "wallet" | "cash" | "promptpay";
/** Local calendar date "YYYY-MM-DD" — no time, no timezone. */
export type LocalDate = string;

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** credit_card / wallet only, exactly 4 digits. */
  last4?: string;
  color?: string;
  hidden?: boolean;
}

export interface Transaction {
  id: string;
  kind: TxKind;
  name: string;
  /** Always > 0; direction comes from `kind`. */
  amountMinor: number;
  currency: Currency;
  /** THB = 1. Locked when the user confirms. */
  fxRateToThb: number;
  date: LocalDate;
  categoryId?: string;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  scope: Scope;
  recurringRuleId?: string;
  occurrenceDate?: LocalDate;
  refundOfId?: string;
  note?: string;
  source: "manual" | "sentence" | "sample" | "import";
  status: "confirmed";
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  /** Sentence entries only: draft fields the user changed from the parser's guess (names, never values). */
  correctedFields?: string[];
}

export interface RecurringRule {
  id: string;
  kind: "income" | "expense";
  name: string;
  amountMinor: number;
  currency: Currency;
  cadence: Cadence;
  /** First charge/receipt date (with a trial: the first charge after it ends). */
  startsOn: LocalDate;
  endsOn?: LocalDate;
  /** Counted from startsOn. */
  maxOccurrences?: number;
  /** Must be ≤ startsOn. */
  trialEndsOn?: LocalDate;
  skippedDates?: LocalDate[];
  categoryId: string;
  accountId?: string;
  scope: Scope;
  note?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  /** Sentence entries only: draft fields the user changed from the parser's guess (names, never values). */
  correctedFields?: string[];
  /** Set when an edit "from the next time on" ended this rule and continued it as another rule. */
  supersededBy?: string;
}

export interface Settings {
  /** 1–28, default 1. */
  cycleStartDay: number;
  fx: { USD: number; EUR: number };
  sideIncomeGoalMinor: number;
  workScopeEnabled: boolean;
}

export interface AppState {
  schemaVersion: 1;
  isSample: boolean;
  settings: Settings;
  accounts: Account[];
  transactions: Transaction[];
  rules: RecurringRule[];
}

export interface Cycle {
  start: LocalDate;
  end: LocalDate;
}

export const DEFAULT_SETTINGS: Settings = {
  cycleStartDay: 1,
  fx: { USD: 33.25, EUR: 36.4 },
  sideIncomeGoalMinor: 1_000_000,
  workScopeEnabled: false,
};
