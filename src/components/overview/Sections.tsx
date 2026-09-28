"use client";

import Link from "next/link";
import { diffDays, formatThaiShort } from "@/domain/dates";
import { formatMoney } from "@/domain/money";
import type { Insight } from "@/domain/insights";
import type { Occurrence, TrialInfo } from "@/domain/recurrence";
import type { SideIncomeProgress } from "@/domain/totals";
import type { Account, Settings } from "@/domain/types";
import { TRIAL_HINT } from "@/lib/copy";
import { CategoryIcon } from "../CategoryIcon";
import { Money, MoneyWithThb } from "../Money";
import { StatusBadge } from "../StatusBadge";

export function Section({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function SideIncomeCard({ progress }: { progress: SideIncomeProgress }) {
  return (
    <div data-testid="side-income" className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">งานเสริม</p>
        <p className="text-sm">
          <Money minor={progress.amountMinor} label="งานเสริม" className="font-semibold" />
          <span className="text-muted"> / เป้า {formatMoney(progress.goalMinor, "THB")}</span>
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="งานเสริมเทียบเป้า"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, progress.percent)}
        aria-valuetext={`${progress.percent}% ${progress.label}`}
        className="h-2.5 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-teal" style={{ width: `${progress.barFraction * 100}%` }} />
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <StatusBadge status="actual" />
        <span className="text-muted">
          {progress.percent}% · {progress.label}
        </span>
      </div>
    </div>
  );
}

export function TrialCards({ trials, settings }: { trials: TrialInfo[]; settings: Settings }) {
  return (
    <ul className="flex flex-col gap-2">
      {trials.map((t) => (
        <li key={t.ruleId} className="flex flex-col gap-1 rounded-2xl bg-coral-soft p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-semibold">{t.name}</p>
            <p className="font-semibold text-coral-ink">{t.daysLeft === 0 ? "หมดวันนี้" : `เหลือ ${t.daysLeft} วัน`}</p>
          </div>
          <p className="text-sm">
            เริ่มหัก {t.firstChargeOn ? formatThaiShort(t.firstChargeOn) : "—"} ·{" "}
            <MoneyWithThb minor={t.amountMinor} currency={t.currency} settings={settings} label="ยอดที่จะเริ่มหัก" />
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status="expected" />
            <span>{TRIAL_HINT}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function OccurrenceList({
  items,
  today,
  settings,
  onPay,
  onSkip,
  testId,
}: {
  items: Occurrence[];
  today: string;
  settings: Settings;
  onPay: (o: Occurrence) => void;
  onSkip?: (o: Occurrence) => void;
  testId: string;
}) {
  return (
    <ul data-testid={testId} className="divide-y divide-line rounded-2xl border border-line bg-card">
      {items.map((o) => {
        const days = diffDays(today, o.date);
        const when = days === 0 ? "วันนี้" : days > 0 ? `อีก ${days} วัน` : `เลยมา ${-days} วัน`;
        return (
          <li key={`${o.ruleId}-${o.date}`} className="flex items-center gap-3 px-4 py-3">
            <CategoryIcon kind={o.kind} categoryId={o.categoryId} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                <span className="sr-only">{o.kind === "income" ? "เงินเข้า " : "เงินออก "}</span>
                {o.name}
              </p>
              <p className="text-sm text-muted">
                {formatThaiShort(o.date)} · {when}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
                <MoneyWithThb
                  minor={o.amountMinor}
                  currency={o.currency}
                  settings={settings}
                  label={o.kind === "income" ? "รายรับ" : "รายจ่าย"}
                  className={o.kind === "income" ? "text-sage" : ""}
                />
                <StatusBadge status={o.status === "overdue" || o.status === "past" ? "overdue" : "expected"} />
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <button
                type="button"
                onClick={() => onPay(o)}
                className="min-h-11 rounded-full border border-teal px-4 text-sm font-semibold text-teal hover:bg-teal-soft"
              >
                {o.kind === "income" ? "ได้รับแล้ว" : "จ่ายแล้ว"}
                <span className="sr-only"> {o.name}</span>
              </button>
              {onSkip && (
                <button type="button" onClick={() => onSkip(o)} className="min-h-9 px-2 text-xs text-muted underline">
                  ข้ามรอบนี้<span className="sr-only"> {o.name}</span>
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export interface AccountSummary {
  account: Account;
  spentMinor: number;
  count: number;
}

export function AccountCards({ items }: { items: AccountSummary[] }) {
  return (
    <ul className="scrollbar-none -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 nav:mx-0 nav:px-0" aria-label="บัญชี (เลื่อนดูได้)" tabIndex={0}>
      {items.map(({ account, spentMinor, count }) => (
        <li key={account.id} className="flex w-44 shrink-0 snap-start flex-col gap-1 rounded-2xl border border-line bg-card p-3">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: account.color ?? "var(--muted)" }} />
            <p className="truncate font-medium">{account.name}</p>
          </div>
          <p className="text-sm text-muted">{account.last4 ? `••${account.last4}` : " "}</p>
          <p className="text-sm">
            จ่ายจริง <Money minor={spentMinor} label={`จ่ายจริงของ ${account.name}`} className="font-semibold" />
          </p>
          <p className="text-xs text-muted">{count} รายการ · เกิดขึ้นแล้ว</p>
        </li>
      ))}
    </ul>
  );
}

export function InsightList({ insights }: { insights: Insight[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {insights.map((i) => {
        const href = i.id === "recurring_monthly" || i.id === "out_over_in" ? "/recurring" : `/transactions?ids=${i.sourceIds.join(",")}`;
        return (
          <li key={i.id} className="flex flex-col gap-1 rounded-2xl border border-line bg-card px-4 py-3">
            <Link href={href} className="font-medium underline-offset-4 hover:underline">
              {i.text}
            </Link>
            <StatusBadge status={i.id === "recurring_monthly" ? "expected" : "actual"} className="self-start" />
          </li>
        );
      })}
    </ul>
  );
}
