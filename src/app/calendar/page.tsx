"use client";

import { useState } from "react";
import { Money } from "@/components/Money";
import { OccurrenceList } from "@/components/overview/Sections";
import { StatusBadge } from "@/components/StatusBadge";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { useUi } from "@/components/ui/UiProvider";
import { IconChevron } from "@/components/icons";
import { calendarMonth, monthGrid, type CalendarDay } from "@/domain/calendar";
import { formatThaiShort, parseLocalDate, THAI_MONTHS_SHORT } from "@/domain/dates";
import type { AppState } from "@/domain/types";
import { useBook } from "@/lib/book";
import { draftFromTransaction } from "@/lib/drafts";
import { useOccurrenceActions } from "@/lib/useOccurrenceActions";

const WEEKDAYS = [
  { short: "อา", full: "อาทิตย์" },
  { short: "จ", full: "จันทร์" },
  { short: "อ", full: "อังคาร" },
  { short: "พ", full: "พุธ" },
  { short: "พฤ", full: "พฤหัสบดี" },
  { short: "ศ", full: "ศุกร์" },
  { short: "ส", full: "เสาร์" },
];

interface Chip {
  key: string;
  label: string;
  expected: boolean;
  income: boolean;
}

function chipsFor(day: CalendarDay): Chip[] {
  const actual = day.actual.map((t) => ({
    key: t.id,
    label: `${t.kind === "income" || t.kind === "refund" ? "+" : t.kind === "transfer" ? "⇄" : "−"}${t.name}`,
    expected: false,
    income: t.kind === "income" || t.kind === "refund",
  }));
  const expected = day.expected.map((o) => ({
    key: `${o.ruleId}-${o.date}`,
    label: `${o.kind === "income" ? "+" : "−"}${o.name}`,
    expected: true,
    income: o.kind === "income",
  }));
  return [...actual, ...expected];
}

function cellLabel(day: CalendarDay, heaviest: boolean): string {
  const parts = [formatThaiShort(day.date)];
  if (day.actual.length) parts.push(`เกิดขึ้นแล้ว ${day.actual.length} รายการ`);
  if (day.expected.length) parts.push(`คาดว่าจะเกิด ${day.expected.length} รายการ`);
  if (heaviest) parts.push("วันที่จ่ายหนักสุด");
  return parts.join(" · ");
}

export default function CalendarPage() {
  const { snapshot, store } = useBook();
  const { openDrafts } = useUi();
  const { pay, skip } = useOccurrenceActions();
  const [monthOffset, setMonthOffset] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  if (!snapshot.ready || !snapshot.state || !store) return <div aria-busy="true" className="h-40 animate-pulse rounded-2xl bg-card" />;
  const state: AppState = snapshot.state;
  const today = store.today();
  const t = parseLocalDate(today);
  const total = t.y * 12 + (t.m - 1) + monthOffset;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const weeks = monthGrid(year, month);
  const cal = calendarMonth(year, month, { ...state, today });
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const selected = picked?.startsWith(monthKey) ? picked : today.startsWith(monthKey) ? today : `${monthKey}-01`;
  const day = cal.days.get(selected)!;
  const move = (n: number) => {
    setMonthOffset((o) => o + n);
    setPicked(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold" aria-live="polite">
          ปฏิทิน {THAI_MONTHS_SHORT[month - 1]} {year}
        </h1>
        <div className="flex gap-1">
          <button type="button" onClick={() => move(-1)} aria-label="เดือนก่อนหน้า" className="grid h-11 w-11 place-items-center rounded-full hover:bg-card">
            <IconChevron dir="left" className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => move(1)} aria-label="เดือนถัดไป" className="grid h-11 w-11 place-items-center rounded-full hover:bg-card">
            <IconChevron className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div data-testid="calendar-summary" className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-2xl border border-line bg-card p-3">
          <p className="text-muted">จ่ายจริงเดือนนี้</p>
          <p className="text-base font-semibold nav:text-lg">
            <Money minor={cal.actualSpendMinor} label="จ่ายจริงเดือนนี้" />
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-3">
          <p className="text-muted">บิลซ้ำที่ตัด</p>
          <p className="text-base font-semibold nav:text-lg">{cal.chargeCount} ครั้ง</p>
        </div>
        <div className="rounded-2xl bg-amber-soft p-3">
          <p className="text-muted">วันจ่ายหนักสุด</p>
          <p className="text-base font-semibold nav:text-lg">{cal.heaviestDay ? formatThaiShort(cal.heaviestDay) : "—"}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted" aria-hidden="true">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-5 rounded bg-ink/80" /> เกิดขึ้นแล้ว
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-5 rounded border border-dashed border-teal" /> คาดว่าจะเกิด
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-5 rounded bg-amber-soft" /> วันจ่ายหนักสุด
        </span>
      </div>

      <table data-testid="calendar" className="w-full table-fixed border-separate border-spacing-1">
        <thead>
          <tr>
            {WEEKDAYS.map((w) => (
              <th key={w.full} scope="col" abbr={w.full} className="text-xs font-medium text-muted">
                {w.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((date, di) => {
                if (!date) return <td key={di} />;
                const d = cal.days.get(date)!;
                const chips = chipsFor(d);
                const heaviest = cal.heaviestDay === date;
                const isToday = date === today;
                const isSelected = date === selected;
                return (
                  <td key={date} className="p-0 align-top">
                    <button
                      type="button"
                      data-date={date}
                      aria-pressed={isSelected}
                      aria-label={cellLabel(d, heaviest)}
                      onClick={() => setPicked(date)}
                      className={`flex h-full min-h-12 w-full flex-col items-stretch gap-0.5 overflow-hidden rounded-xl border p-1 text-left nav:min-h-24 ${
                        isSelected ? "border-teal" : "border-transparent"
                      } ${heaviest ? "bg-amber-soft" : "bg-card"}`}
                    >
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center self-center rounded-full text-xs tabular-nums min-[400px]:self-start ${
                          isToday ? "bg-teal font-semibold text-white" : ""
                        }`}
                      >
                        {parseLocalDate(date).d}
                      </span>
                      {/* Narrow screens: dots only (solid = actual, hollow = expected). */}
                      <span className="flex justify-center gap-0.5 min-[400px]:hidden" aria-hidden="true">
                        {chips.slice(0, 3).map((c) => (
                          <span
                            key={c.key}
                            className={`h-1.5 w-1.5 rounded-full ${c.expected ? "border border-teal" : c.income ? "bg-sage" : "bg-ink/80"}`}
                          />
                        ))}
                      </span>
                      {/* Wider screens: up to 2 short labels + "+N". */}
                      <span className="hidden flex-col gap-0.5 min-[400px]:flex" aria-hidden="true">
                        {chips.slice(0, 2).map((c) => (
                          <span
                            key={c.key}
                            className={`truncate rounded px-1 text-[11px] leading-4 ${
                              c.expected ? "border border-dashed border-teal text-teal" : c.income ? "bg-sage-soft text-sage" : "bg-line text-ink"
                            }`}
                          >
                            {c.label}
                          </span>
                        ))}
                        {chips.length > 2 && <span className="text-[11px] text-muted">+{chips.length - 2}</span>}
                      </span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <section aria-labelledby="day-title" data-testid="day-detail" className="flex flex-col gap-3">
        <h2 id="day-title" className="text-base font-semibold">
          {formatThaiShort(selected)} {year}
          {cal.heaviestDay === selected && <span className="ml-2 rounded-full bg-amber-soft px-2 text-xs font-medium text-amber-ink">วันจ่ายหนักสุด</span>}
        </h2>
        <div className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <StatusBadge status="actual" /> {day.actual.length} รายการ
          </h3>
          {day.actual.length ? (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
              {day.actual.map((tx) => (
                <li key={tx.id}>
                  <TransactionRow tx={tx} state={state} onOpen={() => openDrafts({ drafts: [draftFromTransaction(tx, state.rules)], source: tx.source, edit: tx })} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">ไม่มีรายการที่เกิดขึ้นแล้ว</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <StatusBadge status="expected" /> {day.expected.length} รายการ
          </h3>
          {day.expected.length ? (
            <OccurrenceList testId="day-expected" items={day.expected} today={today} settings={state.settings} onPay={pay} onSkip={skip} />
          ) : (
            <p className="text-sm text-muted">ไม่มีรายการที่คาดว่าจะเกิด</p>
          )}
        </div>
      </section>
    </div>
  );
}
