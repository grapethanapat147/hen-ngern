"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useId, useState } from "react";
import { CycleHeader } from "@/components/CycleHeader";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { useUi } from "@/components/ui/UiProvider";
import { cycleFor, cycleLabel, shiftCycle } from "@/domain/cycle";
import { formatThaiShort } from "@/domain/dates";
import { cycleTransactions, dayNetMinor, filterTransactions, listTotalMinor, type ListFilter } from "@/domain/totals";
import type { Transaction } from "@/domain/types";
import { Money } from "@/components/Money";
import { useBook } from "@/lib/book";
import { blankDraft, draftFromTransaction, nextDraftKey } from "@/lib/drafts";

const CHIPS: { value: ListFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "income", label: "รายรับ" },
  { value: "expense", label: "รายจ่าย" },
  { value: "transfer", label: "โอน" },
];

const TOTAL_LABEL: Record<ListFilter, string> = {
  all: "สุทธิ (ไม่รวมโอน)",
  income: "รับรวม",
  expense: "จ่ายรวม (หักคืนเงินแล้ว)",
  transfer: "ย้ายเงินรวม (ไม่นับเป็นรายรับรายจ่าย)",
};

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div aria-busy="true" className="h-40 animate-pulse rounded-2xl bg-card" />}>
      <TransactionsView />
    </Suspense>
  );
}

function TransactionsView() {
  const { snapshot, store } = useBook();
  const { openDrafts } = useUi();
  const params = useSearchParams();
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<ListFilter>("all");
  const [workOnly, setWorkOnly] = useState(false);
  const [search, setSearch] = useState("");
  const searchId = useId();

  if (!snapshot.ready || !snapshot.state || !store) return <div aria-busy="true" className="h-40 animate-pulse rounded-2xl bg-card" />;
  const state = snapshot.state;
  const { settings } = state;
  const today = store.today();
  const startDay = settings.cycleStartDay;
  const cycle = shiftCycle(cycleFor(today, startDay), offset, startDay);

  // Coming from ความเห็นจากสมุด: show exactly the source rows.
  const ids = params.get("ids")?.split(",").filter(Boolean) ?? [];
  const pinned = ids.length > 0;
  const base = pinned ? state.transactions.filter((t) => ids.includes(t.id)) : cycleTransactions({ transactions: state.transactions, cycle });
  const rows = filterTransactions(base, { filter, workOnly: settings.workScopeEnabled && workOnly, search });
  const total = listTotalMinor(rows, filter);

  const groups: { date: string; items: Transaction[] }[] = [];
  for (const t of rows) {
    const last = groups[groups.length - 1];
    if (last?.date === t.date) last.items.push(t);
    else groups.push({ date: t.date, items: [t] });
  }

  const edit = (t: Transaction) => openDrafts({ drafts: [draftFromTransaction(t, state.rules)], source: t.source, edit: t });
  const add = () => openDrafts({ drafts: [blankDraft(today, state.accounts, nextDraftKey("new"))], source: "manual" });

  return (
    <div className="flex flex-col gap-4">
      {pinned ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">รายการที่มาของความเห็น ({rows.length})</h1>
          <Link href="/transactions" className="min-h-11 content-center text-sm text-teal underline">
            ดูทั้งหมด
          </Link>
        </div>
      ) : (
        <CycleHeader label={cycleLabel(cycle, startDay)} offset={offset} setOffset={setOffset} />
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor={searchId} className="sr-only">
          ค้นหาชื่อ
        </label>
        <input
          id={searchId}
          type="search"
          placeholder="ค้นหาชื่อ"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-11 rounded-full border border-line bg-card px-4 text-base"
        />
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="ตัวกรอง">
          {CHIPS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={filter === c.value}
              onClick={() => setFilter(c.value)}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${filter === c.value ? "border-teal bg-teal text-white" : "border-line bg-card"}`}
            >
              {c.label}
            </button>
          ))}
          {settings.workScopeEnabled && (
            <button
              type="button"
              aria-pressed={workOnly}
              onClick={() => setWorkOnly((w) => !w)}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${workOnly ? "border-navy bg-navy text-white" : "border-line bg-card"}`}
            >
              งาน
            </button>
          )}
        </div>
      </div>

      <div data-testid="list-total" className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-card px-4 py-3">
        <div>
          <p className="text-sm text-muted">{TOTAL_LABEL[filter]}</p>
          <p className="text-xs text-muted">{rows.length} รายการ · เกิดขึ้นแล้ว</p>
        </div>
        <Money minor={total} label={TOTAL_LABEL[filter]} className="text-xl font-semibold" />
      </div>

      <button type="button" onClick={add} className="min-h-11 self-start rounded-full bg-teal px-5 font-semibold text-white">
        + รายการ
      </button>

      {groups.length === 0 ? (
        <p className="text-sm text-muted">{search || filter !== "all" ? "ไม่พบรายการที่ตรงกับตัวกรอง" : "ยังไม่มีรายการในรอบนี้ ลองพิมพ์ประโยคด้านบน"}</p>
      ) : (
        <div data-testid="tx-list" className="flex flex-col gap-4">
          {groups.map((g) => {
            const net = dayNetMinor(g.items);
            return (
              <section key={g.date} aria-label={`วันที่ ${formatThaiShort(g.date)}`}>
                <div className="flex items-baseline justify-between px-1 pb-1 text-sm">
                  <h2 className="font-semibold">{formatThaiShort(g.date)}</h2>
                  <span className="text-muted">
                    สุทธิ <Money minor={net} label="สุทธิของวัน" />
                  </span>
                </div>
                <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
                  {g.items.map((t) => (
                    <li key={t.id}>
                      <TransactionRow tx={t} state={state} onOpen={() => edit(t)} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
