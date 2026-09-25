"use client";

import { useState } from "react";
import { cycleFor, cycleLabel, shiftCycle } from "@/domain/cycle";
import { addDays } from "@/domain/dates";
import { bookInsights } from "@/domain/insights";
import { parseSentence } from "@/domain/parser";
import { listOccurrences, trialInfo, type TrialInfo } from "@/domain/recurrence";
import { accountBreakdown, cycleTotals, cycleTransactions, sideIncomeProgress } from "@/domain/totals";
import { CycleHeader } from "@/components/CycleHeader";
import { AccountCards, InsightList, OccurrenceList, Section, SideIncomeCard, TrialCards } from "@/components/overview/Sections";
import { StatTiles } from "@/components/overview/StatTiles";
import { useUi } from "@/components/ui/UiProvider";
import { useBook } from "@/lib/book";
import { POLICY_SHORT, SENTENCE } from "@/lib/copy";
import { draftFromOccurrence, toEditable } from "@/lib/drafts";

export default function OverviewPage() {
  const { snapshot, store } = useBook();
  const { openDrafts } = useUi();
  const [offset, setOffset] = useState(0);

  if (!snapshot.ready || !snapshot.state || !store) {
    return (
      <div aria-busy="true" className="grid grid-cols-2 gap-2 nav:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-card" />
        ))}
      </div>
    );
  }

  const state = snapshot.state;
  const { settings } = state;
  const today = store.today();
  const startDay = settings.cycleStartDay;
  const current = cycleFor(today, startDay);
  const cycle = shiftCycle(current, offset, startDay);
  const slice = { ...state, cycle, today };
  const totals = cycleTotals(slice);
  const occCtx = { today, cycleStartDay: startDay, transactions: state.transactions, settings };

  const upcoming = listOccurrences(state.rules, today, addDays(today, 7), occCtx).filter((o) => o.status === "upcoming");
  const overdue =
    today > current.start
      ? listOccurrences(state.rules, current.start, addDays(today, -1), occCtx).filter((o) => o.status === "overdue")
      : [];
  const trials = state.rules.map((r) => trialInfo(r, today, settings)).filter((t): t is TrialInfo => Boolean(t));

  const live = cycleTransactions(slice);
  const spend = new Map(accountBreakdown(slice).map((b) => [b.key, b.amountMinor]));
  const accounts = state.accounts
    .filter((a) => !a.hidden)
    .map((account) => ({
      account,
      spentMinor: spend.get(account.id) ?? 0,
      count: live.filter((t) => t.accountId === account.id || t.fromAccountId === account.id || t.toAccountId === account.id).length,
    }));
  const insights = bookInsights(slice, state.accounts);
  const isEmpty = state.transactions.every((t) => t.deletedAt) && state.rules.every((r) => r.deletedAt);

  const pay = (o: (typeof upcoming)[number]) =>
    openDrafts({ drafts: [draftFromOccurrence(o, `${o.ruleId}-${o.date}`)], source: "manual" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <CycleHeader label={cycleLabel(cycle, startDay)} offset={offset} setOffset={setOffset} />
        <StatTiles totals={totals} />
      </div>

      {isEmpty && (
        <Section title="ลองพิมพ์ประโยคแรก" id="try">
          <div className="flex flex-wrap gap-2">
            {SENTENCE.examples.map((example) => (
              <button
                key={example}
                type="button"
                className="min-h-11 rounded-full border border-line bg-card px-4 text-sm hover:border-teal"
                onClick={() =>
                  openDrafts({
                    drafts: parseSentence(example, { today, accounts: state.accounts, settings }).map((d, i) => toEditable(d, `${example}-${i}`)),
                    source: "sentence",
                  })
                }
              >
                {example}
              </button>
            ))}
          </div>
        </Section>
      )}

      <div className="grid gap-6 nav:grid-cols-2">
        <div className="flex flex-col gap-6">
          <SideIncomeCard progress={sideIncomeProgress(totals.sideIncomeMinor, settings.sideIncomeGoalMinor)} />

          {trials.length > 0 && (
            <Section title="ช่วงทดลองใช้ฟรี" id="trials">
              <TrialCards trials={trials} settings={settings} />
            </Section>
          )}

          <Section title="ใกล้ตัดใน 7 วัน" id="upcoming">
            {upcoming.length ? (
              <OccurrenceList testId="upcoming" items={upcoming} today={today} settings={settings} onPay={pay} />
            ) : (
              <p className="text-sm text-muted">ไม่มีรายการที่จะถึงใน 7 วัน</p>
            )}
          </Section>

          {overdue.length > 0 && (
            <Section title="เลยกำหนด ยังไม่ยืนยัน" id="overdue">
              <p className="text-sm text-muted">ยังไม่นับในยอดจริงจนกว่าจะกดยืนยัน</p>
              <OccurrenceList testId="overdue" items={overdue} today={today} settings={settings} onPay={pay} />
            </Section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Section title="บัญชี" id="accounts">
            <AccountCards items={accounts} />
          </Section>

          <Section title="ความเห็นจากสมุด" id="insights">
            {insights.length ? <InsightList insights={insights} /> : <p className="text-sm text-muted">ยังไม่มีรายการพอให้สรุป</p>}
          </Section>
        </div>
      </div>

      <p className="text-center text-xs text-muted nav:hidden">{POLICY_SHORT}</p>
    </div>
  );
}
