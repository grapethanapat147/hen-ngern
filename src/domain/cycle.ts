import { addMonths, clampedDate, daysInMonth, formatThaiShort, parseLocalDate, THAI_MONTHS_SHORT } from "./dates";
import type { Cycle, LocalDate } from "./types";

/** The budgeting cycle containing `date`. `startDay` is 1–28; 1 = calendar month. */
export function cycleFor(date: LocalDate, startDay: number): Cycle {
  const { y, m, d } = parseLocalDate(date);
  if (startDay <= 1) {
    return { start: clampedDate(y, m, 1), end: clampedDate(y, m, daysInMonth(y, m)) };
  }
  const startMonth = d >= startDay ? m : m - 1;
  return {
    start: clampedDate(y, startMonth, startDay),
    end: clampedDate(y, startMonth + 1, startDay - 1),
  };
}

/** `ต.ค. 2026` for calendar months, otherwise `25 ก.ย. – 24 ต.ค.` */
export function cycleLabel(cycle: Cycle, startDay: number): string {
  if (startDay <= 1) {
    const { y, m } = parseLocalDate(cycle.start);
    return `${THAI_MONTHS_SHORT[m - 1]} ${y}`;
  }
  return `${formatThaiShort(cycle.start)} – ${formatThaiShort(cycle.end)}`;
}

/** Move `n` cycles forward (negative = back). */
export function shiftCycle(cycle: Cycle, n: number, startDay: number): Cycle {
  return cycleFor(addMonths(cycle.start, n), startDay);
}

export const inCycle = (date: LocalDate, cycle: Cycle): boolean => date >= cycle.start && date <= cycle.end;
