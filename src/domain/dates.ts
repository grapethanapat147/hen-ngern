import type { LocalDate } from "./types";

// Local dates are handled as numbers — never `new Date("YYYY-MM-DD")`, which parses as UTC.

export interface YMD {
  y: number;
  m: number; // 1–12
  d: number;
}

export function parseLocalDate(s: LocalDate): YMD {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Invalid LocalDate: ${s}`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export function isLocalDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export function formatLocalDate({ y, m, d }: YMD): LocalDate {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Build a date, clamping the day to the month's last day (Jan 31 + 1 month → Feb 28). */
export function clampedDate(y: number, m: number, d: number): LocalDate {
  // Normalise month overflow first.
  const total = y * 12 + (m - 1);
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return formatLocalDate({ y: ny, m: nm, d: Math.min(d, daysInMonth(ny, nm)) });
}

/** Days since 1970-01-01 for a local date (calendar arithmetic only). */
function toDayNumber(s: LocalDate): number {
  const { y, m, d } = parseLocalDate(s);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

function fromDayNumber(n: number): LocalDate {
  const dt = new Date(n * 86_400_000);
  return formatLocalDate({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });
}

export const addDays = (s: LocalDate, days: number): LocalDate => fromDayNumber(toDayNumber(s) + days);

/** b − a in days. */
export const diffDays = (a: LocalDate, b: LocalDate): number => toDayNumber(b) - toDayNumber(a);

export function addMonths(s: LocalDate, months: number, anchorDay?: number): LocalDate {
  const { y, m, d } = parseLocalDate(s);
  return clampedDate(y, m + months, anchorDay ?? d);
}

/** 0 = Sunday. */
export const dayOfWeek = (s: LocalDate): number => (((toDayNumber(s) + 4) % 7) + 7) % 7;

export const minDate = (a: LocalDate, b: LocalDate): LocalDate => (a < b ? a : b);
export const maxDate = (a: LocalDate, b: LocalDate): LocalDate => (a > b ? a : b);

/** Today on the user's device. */
export function todayLocal(now: Date = new Date()): LocalDate {
  return formatLocalDate({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });
}

export const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
] as const;

export const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
] as const;

/** `5 ต.ค.` */
export function formatThaiShort(s: LocalDate): string {
  const { m, d } = parseLocalDate(s);
  return `${d} ${THAI_MONTHS_SHORT[m - 1]}`;
}

/** Buddhist-era years (≥ 2400) become Common Era. */
export const toCommonEraYear = (y: number): number => (y >= 2400 ? y - 543 : y);
