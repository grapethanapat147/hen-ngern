import { addDays, clampedDate, dayOfWeek, daysInMonth, formatLocalDate } from "./dates";
import { txThbMinor } from "./money";
import { listOccurrences, type Occurrence } from "./recurrence";
import type { LocalDate, RecurringRule, Settings, Transaction } from "./types";

// Month calendar — docs/01-product-brief.md §5.6. Actual and expected are kept in separate lists per day.

/** Weeks of a calendar month, Sunday first; `null` pads days outside the month. */
export function monthGrid(year: number, month: number): (LocalDate | null)[][] {
  const first = clampedDate(year, month, 1);
  const days = daysInMonth(year, month);
  const cells: (LocalDate | null)[] = Array.from({ length: dayOfWeek(first) }, () => null);
  for (let d = 1; d <= days; d++) cells.push(formatLocalDate({ y: year, m: month, d }));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (LocalDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export interface CalendarDay {
  date: LocalDate;
  actual: Transaction[];
  /** Occurrences not yet matched to a real entry (upcoming, overdue or past). */
  expected: Occurrence[];
  /** Actual spend that day: expense − refund (THB minor). */
  spentMinor: number;
}

export interface CalendarMonth {
  days: Map<LocalDate, CalendarDay>;
  /** Σ actual expense − refund in the month. */
  actualSpendMinor: number;
  /** Recurring expense charges scheduled in the month (paid or not; skipped excluded). */
  chargeCount: number;
  /** Day with the highest actual spend, if any spend. */
  heaviestDay?: LocalDate;
}

export function calendarMonth(
  year: number,
  month: number,
  input: { transactions: Transaction[]; rules: RecurringRule[]; settings: Settings; today: LocalDate },
): CalendarMonth {
  const start = clampedDate(year, month, 1);
  const end = clampedDate(year, month, daysInMonth(year, month));
  const days = new Map<LocalDate, CalendarDay>();
  for (let d = start; d <= end; d = addDays(d, 1)) days.set(d, { date: d, actual: [], expected: [], spentMinor: 0 });

  let actualSpend = 0;
  for (const t of input.transactions) {
    const day = !t.deletedAt ? days.get(t.date) : undefined;
    if (!day) continue;
    day.actual.push(t);
    const signed = t.kind === "expense" ? txThbMinor(t) : t.kind === "refund" ? -txThbMinor(t) : 0;
    day.spentMinor += signed;
    actualSpend += signed;
  }

  const occurrences = listOccurrences(input.rules, start, end, {
    today: input.today,
    cycleStartDay: input.settings.cycleStartDay,
    transactions: input.transactions,
    settings: input.settings,
  });
  let chargeCount = 0;
  for (const o of occurrences) {
    if (o.kind === "expense") chargeCount += 1;
    if (o.status !== "matched") days.get(o.date)?.expected.push(o);
  }

  let heaviestDay: LocalDate | undefined;
  let heaviest = 0;
  for (const day of days.values()) {
    if (day.spentMinor > heaviest) {
      heaviest = day.spentMinor;
      heaviestDay = day.date;
    }
  }
  return { days, actualSpendMinor: actualSpend, chargeCount, heaviestDay };
}
