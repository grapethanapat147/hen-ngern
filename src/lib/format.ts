import { addDays, dayOfWeek, formatThaiShort, parseLocalDate } from "@/domain/dates";
import { occurrenceDates } from "@/domain/recurrence";
import type { LocalDate, RecurringRule } from "@/domain/types";

const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

/** `ทุกเดือน วันที่ 5` · `ทุกปี 15 ก.ย.` · `ทุกสัปดาห์ วันพฤหัสบดี` */
export function cadenceText(rule: Pick<RecurringRule, "cadence" | "startsOn">): string {
  if (rule.cadence === "month") return `ทุกเดือน วันที่ ${parseLocalDate(rule.startsOn).d}`;
  if (rule.cadence === "year") return `ทุกปี ${formatThaiShort(rule.startsOn)}`;
  return `ทุกสัปดาห์ วัน${THAI_DAYS[dayOfWeek(rule.startsOn)]}`;
}

/** `จบ 31 ต.ค.` / `เหลือ 3 ครั้ง` / null when open-ended. */
export function endText(rule: RecurringRule, today: LocalDate): string | null {
  const parts: string[] = [];
  if (rule.endsOn) parts.push(`จบ ${formatThaiShort(rule.endsOn)}`);
  if (rule.maxOccurrences !== undefined) {
    const used = occurrenceDates(rule, rule.startsOn, addDays(today, -1)).length;
    parts.push(`เหลือ ${Math.max(0, rule.maxOccurrences - used)} ครั้ง`);
  }
  return parts.length ? parts.join(" · ") : null;
}

/** `วันนี้` / `อีก 3 วัน` / `เลยมา 2 วัน` */
export function relativeDays(days: number): string {
  return days === 0 ? "วันนี้" : days > 0 ? `อีก ${days} วัน` : `เลยมา ${-days} วัน`;
}
