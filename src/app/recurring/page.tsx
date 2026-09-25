"use client";

import { MoneyWithThb, Money } from "@/components/Money";
import { StatusBadge } from "@/components/StatusBadge";
import { useUi } from "@/components/ui/UiProvider";
import { cycleFor, inCycle } from "@/domain/cycle";
import { addDays, diffDays, formatThaiShort } from "@/domain/dates";
import { actualVsExpectedDiffMinor } from "@/domain/matching";
import { formatSignedThb, txThbMinor } from "@/domain/money";
import { listOccurrences, nextOccurrence, trialInfo, type Occurrence } from "@/domain/recurrence";
import { isRuleActive, recurringSummary } from "@/domain/rules";
import type { AppState, RecurringRule, Transaction } from "@/domain/types";
import { useBook } from "@/lib/book";
import { blankDraft, nextDraftKey } from "@/lib/drafts";
import { cadenceText, endText, relativeDays } from "@/lib/format";
import { useOccurrenceActions } from "@/lib/useOccurrenceActions";

interface RuleRow {
  rule: RecurringRule;
  accountName: string;
  nextDate?: string;
  /** First occurrence still waiting for จ่ายแล้ว (overdue first). */
  due?: Occurrence;
  lastPaid?: { tx: Transaction; diff: number | null };
  trialEndsOn?: string;
  end: string | null;
}

function buildRows(state: AppState, today: string): { active: RuleRow[]; ended: RuleRow[] } {
  const current = cycleFor(today, state.settings.cycleStartDay);
  const ctx = { today, cycleStartDay: state.settings.cycleStartDay, transactions: state.transactions, settings: state.settings };
  const rows = state.rules
    .filter((r) => !r.deletedAt && !r.supersededBy)
    .map((rule): RuleRow => {
      const pending = listOccurrences([rule], current.start, addDays(today, 400), ctx).find((o) => o.status === "overdue" || o.status === "upcoming");
      const paid = state.transactions
        .filter((t) => !t.deletedAt && t.recurringRuleId === rule.id && t.occurrenceDate && inCycle(t.occurrenceDate, current))
        .sort((a, b) => (a.occurrenceDate! < b.occurrenceDate! ? 1 : -1))[0];
      const account = state.accounts.find((a) => a.id === rule.accountId);
      return {
        rule,
        accountName: account ? `${account.name}${account.last4 ? ` ••${account.last4}` : ""}` : "ไม่ระบุบัญชี",
        nextDate: nextOccurrence(rule, today),
        due: pending,
        lastPaid: paid ? { tx: paid, diff: actualVsExpectedDiffMinor(rule, paid, state.settings) } : undefined,
        trialEndsOn: trialInfo(rule, today, state.settings)?.trialEndsOn,
        end: endText(rule, today),
      };
    })
    .sort((a, b) => (a.nextDate ?? "9999") < (b.nextDate ?? "9999") ? -1 : 1);
  return { active: rows.filter((r) => isRuleActive(r.rule, today)), ended: rows.filter((r) => !isRuleActive(r.rule, today)) };
}

export default function RecurringPage() {
  const { snapshot, store } = useBook();
  const { openDrafts, openRule } = useUi();
  const { pay, skip } = useOccurrenceActions();
  if (!snapshot.ready || !snapshot.state || !store) return <div aria-busy="true" className="h-40 animate-pulse rounded-2xl bg-card" />;

  const state = snapshot.state;
  const today = store.today();
  const summary = recurringSummary(state.rules, state.settings, today);
  const { active, ended } = buildRows(state, today);
  const addRule = () =>
    openDrafts({ drafts: [{ ...blankDraft(today, state.accounts, nextDraftKey("rule")), cadence: "month" }], source: "manual" });

  const actions = (row: RuleRow) =>
    row.due ? (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => pay(row.due!)}
          className="min-h-11 rounded-full border border-teal px-4 text-sm font-semibold text-teal hover:bg-teal-soft"
        >
          {row.rule.kind === "income" ? "ได้รับแล้ว" : "จ่ายแล้ว"} {formatThaiShort(row.due.date)}
          <span className="sr-only"> {row.rule.name}</span>
        </button>
        <button type="button" onClick={() => skip(row.due!)} className="min-h-11 px-2 text-sm text-muted underline">
          ข้ามรอบนี้<span className="sr-only"> {row.rule.name}</span>
        </button>
      </div>
    ) : null;

  const due = (row: RuleRow) =>
    row.due?.status === "overdue" ? (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <StatusBadge status="overdue" /> {formatThaiShort(row.due.date)}
      </span>
    ) : row.nextDate ? (
      <span>
        {formatThaiShort(row.nextDate)} · {relativeDays(diffDays(today, row.nextDate))}
      </span>
    ) : (
      <span className="text-muted">ไม่มีรอบถัดไป</span>
    );

  const paid = (row: RuleRow) =>
    row.lastPaid ? (
      <span className="text-sm">
        {row.rule.kind === "income" ? "ได้รับจริง" : "จ่ายจริง"}รอบนี้ <Money minor={txThbMinor(row.lastPaid.tx)} />
        {row.lastPaid.diff !== null && row.lastPaid.diff !== 0 && (
          <span className="text-amber-ink"> · ต่างจากที่คาด {formatSignedThb(row.lastPaid.diff)}</span>
        )}
      </span>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">รายการซ้ำ</h1>

      <div data-testid="recurring-summary" className="grid grid-cols-2 gap-2 nav:grid-cols-3">
        <div className="rounded-2xl border border-line bg-card p-3">
          <p className="text-sm text-muted">ใช้อยู่</p>
          <p className="text-xl font-semibold">{summary.activeCount} รายการ</p>
        </div>
        <div className="rounded-2xl border-2 border-dashed border-teal/50 bg-card p-3">
          <p className="text-sm text-muted">เงินออกเฉลี่ย</p>
          <p className="text-xl font-semibold">
            ≈ <Money minor={summary.expense.monthlyMinor} label="เงินออกเฉลี่ยต่อเดือน" />
            <span className="text-sm font-normal text-muted">/เดือน</span>
          </p>
          <p className="text-sm text-muted">
            ≈ <Money minor={summary.expense.yearlyMinor} label="ต่อปี" />/ปี
          </p>
          <StatusBadge status="expected" className="mt-1" />
        </div>
        <div className="col-span-2 rounded-2xl border-2 border-dashed border-teal/50 bg-card p-3 nav:col-span-1">
          <p className="text-sm text-muted">เงินเข้าเฉลี่ย</p>
          <p className="text-xl font-semibold text-sage">
            ≈ <Money minor={summary.income.monthlyMinor} label="เงินเข้าเฉลี่ยต่อเดือน" />
            <span className="text-sm font-normal text-muted">/เดือน</span>
          </p>
          <p className="text-sm text-muted">
            ≈ <Money minor={summary.income.yearlyMinor} label="ต่อปี" />/ปี
          </p>
          <StatusBadge status="expected" className="mt-1" />
        </div>
      </div>
      {summary.missingFxCount > 0 && <p className="text-sm text-muted">รออัตราแลกเปลี่ยน {summary.missingFxCount} รายการ (ไม่รวมในยอดเฉลี่ย)</p>}

      <button type="button" onClick={addRule} className="min-h-11 self-start rounded-full bg-teal px-5 font-semibold text-white">
        + บิลซ้ำ
      </button>

      {active.length === 0 && <p className="text-sm text-muted">ยังไม่มีรายการซ้ำ ลองพิมพ์ เช่น จ่าย Netflix 419 ทุกเดือนวันที่ 5</p>}

      {/* Mobile: cards */}
      <ul className="flex flex-col gap-2 nav:hidden">
        {active.map((row) => (
          <li key={row.rule.id} data-rule={row.rule.name} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className={`text-xs font-medium ${row.rule.kind === "income" ? "text-sage" : "text-muted"}`}>{row.rule.kind === "income" ? "เงินเข้า" : "เงินออก"}</span>
                <button type="button" onClick={() => openRule(row.rule)} className="block min-h-11 truncate text-left font-semibold underline-offset-4 hover:underline">
                  {row.rule.name}
                  <span className="sr-only"> แก้ไข</span>
                </button>
              </div>
              <MoneyWithThb minor={row.rule.amountMinor} currency={row.rule.currency} settings={state.settings} className="text-right text-sm font-semibold" />
            </div>
            <p className="text-sm text-muted">
              {cadenceText(row.rule)} · {row.accountName}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="text-muted">ครั้งถัดไป</span> {due(row)}
              {row.end && <span className="text-muted">· {row.end}</span>}
              {row.trialEndsOn && <span className="rounded-full bg-coral-soft px-2 text-xs text-coral-ink">ทดลองถึง {formatThaiShort(row.trialEndsOn)}</span>}
            </p>
            {paid(row)}
            {actions(row)}
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      {active.length > 0 && (
        <div className="hidden overflow-x-auto rounded-2xl border border-line bg-card nav:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">ชื่อ</th>
                <th className="px-3 py-2 font-medium">รอบ</th>
                <th className="px-3 py-2 text-right font-medium">ราคา</th>
                <th className="px-3 py-2 font-medium">บัญชี</th>
                <th className="px-3 py-2 font-medium">ครั้งถัดไป</th>
                <th className="px-3 py-2 font-medium">จบ / ทดลอง</th>
                <th className="px-3 py-2 font-medium">
                  <span className="sr-only">การทำงาน</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {active.map((row) => (
                <tr key={row.rule.id} data-rule={row.rule.name} className="align-top">
                  <td className="px-3 py-3">
                    <span className={`block text-xs ${row.rule.kind === "income" ? "text-sage" : "text-muted"}`}>{row.rule.kind === "income" ? "เงินเข้า" : "เงินออก"}</span>
                    <button type="button" onClick={() => openRule(row.rule)} className="text-left font-semibold underline-offset-4 hover:underline">
                      {row.rule.name}
                      <span className="sr-only"> แก้ไข</span>
                    </button>
                    <div>
                      {paid(row)}
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{cadenceText(row.rule)}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <MoneyWithThb minor={row.rule.amountMinor} currency={row.rule.currency} settings={state.settings} />
                  </td>
                  <td className="px-3 py-3">{row.accountName}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {due(row)}
                  </td>
                  <td className="px-3 py-3">
                    {row.end ?? "—"}
                    {row.trialEndsOn && <div className="text-coral-ink">ทดลองถึง {formatThaiShort(row.trialEndsOn)}</div>}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {actions(row)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ended.length > 0 && (
        <details className="rounded-2xl border border-line bg-card p-4">
          <summary className="min-h-11 cursor-pointer content-center font-medium">เลิกใช้แล้ว ({ended.length})</summary>
          <ul className="mt-2 divide-y divide-line">
            {ended.map((row) => (
              <li key={row.rule.id} data-ended-rule={row.rule.name} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="block truncate">{row.rule.name}</span>
                  <span className="text-sm text-muted">{row.end ?? cadenceText(row.rule)}</span>
                </span>
                <button type="button" onClick={() => openRule(row.rule)} className="min-h-11 shrink-0 rounded-full border border-line px-4 text-sm">
                  เปิด<span className="sr-only"> {row.rule.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
