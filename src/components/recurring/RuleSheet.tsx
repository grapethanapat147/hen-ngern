"use client";

import { useId, useState, type ReactNode } from "react";
import { CATEGORIES } from "@/domain/categories";
import { formatThaiShort } from "@/domain/dates";
import { parseAmountToMinor } from "@/domain/money";
import { editRuleFromNext, hasHistory, hasLinkedTransactions, isRuleActive, resumeRule, ruleIssues, stopRule } from "@/domain/rules";
import type { Cadence, Currency, RecurringRule } from "@/domain/types";
import type { BookAction } from "@/data/reducer";
import { useBook } from "@/lib/book";
import { minorToInput } from "@/lib/drafts";
import { MoneyWithThb } from "../Money";
import { Sheet } from "../ui/Sheet";
import { useUi } from "../ui/UiProvider";

const inputClass = "min-h-11 w-full rounded-xl border border-line bg-card px-3 text-base text-ink focus-visible:border-teal";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

export function RuleSheet({ rule, onClose }: { rule: RecurringRule | null; onClose: () => void }) {
  return (
    <Sheet open={rule !== null} onClose={onClose} title="แก้ไขรายการซ้ำ">
      {rule && <RuleEditor key={rule.id + rule.updatedAt} rule={rule} onClose={onClose} />}
    </Sheet>
  );
}

function RuleEditor({ rule, onClose }: { rule: RecurringRule; onClose: () => void }) {
  const { snapshot, store } = useBook();
  const { toast } = useUi();
  const uid = useId();
  const id = (f: string) => `${uid}-${f}`;
  const [form, setForm] = useState({
    kind: rule.kind,
    name: rule.name,
    amountText: minorToInput(rule.amountMinor),
    currency: rule.currency,
    cadence: rule.cadence,
    startsOn: rule.startsOn,
    endsOn: rule.endsOn ?? "",
    maxText: rule.maxOccurrences ? String(rule.maxOccurrences) : "",
    trialEndsOn: rule.trialEndsOn ?? "",
    categoryId: rule.categoryId,
    accountId: rule.accountId ?? "",
    scope: rule.scope,
  });
  const [applyMode, setApplyMode] = useState<"next" | "all">("next");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const state = snapshot.state;
  if (!state || !store) return null;

  const today = store.today();
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const amountMinor = parseAmountToMinor(form.amountText);
  const maxOccurrences = form.maxText.trim() ? Number(form.maxText) : undefined;
  const issues = ruleIssues({
    name: form.name,
    amountMinor,
    startsOn: form.startsOn,
    endsOn: form.endsOn || undefined,
    maxOccurrences,
    trialEndsOn: form.trialEndsOn || undefined,
    kind: form.kind,
  });
  const history = hasHistory(rule, today);
  const active = isRuleActive(rule, today);
  const linked = hasLinkedTransactions(rule, state.transactions);
  const categories = CATEGORIES.filter((c) => c.kind === form.kind);
  const accounts = state.accounts.filter((a) => !a.hidden);

  const commit = (actions: BookAction[], undo: BookAction[], message: string) => {
    store.dispatch({ type: "batch", actions });
    onClose();
    toast({ message, actionLabel: "เลิกทำ", onAction: () => store.dispatch({ type: "batch", actions: undo }) });
  };

  const save = () => {
    const nowIso = store.nowIso();
    const edited: RecurringRule = {
      ...rule,
      kind: form.kind,
      name: form.name.trim(),
      amountMinor: amountMinor!,
      currency: form.currency,
      cadence: form.cadence,
      startsOn: form.startsOn,
      categoryId: form.categoryId,
      scope: form.scope,
      updatedAt: nowIso,
    };
    const optional = { endsOn: form.endsOn || undefined, maxOccurrences, trialEndsOn: form.kind === "expense" ? form.trialEndsOn || undefined : undefined, accountId: form.accountId || undefined };
    for (const [k, v] of Object.entries(optional)) {
      if (v === undefined) delete (edited as unknown as Record<string, unknown>)[k];
      else (edited as unknown as Record<string, unknown>)[k] = v;
    }

    if (applyMode === "all" || !history) {
      commit([{ type: "update_rule", rule: edited, nowIso }], [{ type: "update_rule", rule, nowIso }], "บันทึกแล้ว");
      return;
    }
    const result = editRuleFromNext(rule, edited, today, { newId: () => crypto.randomUUID(), nowIso, transactions: state.transactions });
    const originals = state.transactions.filter((t) => result.transactions.some((m) => m.id === t.id));
    commit(
      [
        ...result.rules.filter((r) => r.id === rule.id).map((r): BookAction => ({ type: "update_rule", rule: r, nowIso })),
        ...result.newRules.map((r): BookAction => ({ type: "add_rule", rule: r })),
        ...result.transactions.map((t): BookAction => ({ type: "update_transaction", transaction: t, nowIso })),
      ],
      [
        { type: "update_rule", rule, nowIso },
        ...result.newRules.map((r): BookAction => ({ type: "delete_rule", id: r.id, nowIso })),
        ...originals.map((t): BookAction => ({ type: "update_transaction", transaction: t, nowIso })),
      ],
      "บันทึกแล้ว · มีผลตั้งแต่ครั้งต่อไป",
    );
  };

  const stop = () => {
    const nowIso = store.nowIso();
    commit([{ type: "update_rule", rule: stopRule(rule, today, nowIso), nowIso }], [{ type: "update_rule", rule, nowIso }], "เลิกใช้แล้ว");
  };
  const resume = () => {
    const nowIso = store.nowIso();
    commit([{ type: "update_rule", rule: resumeRule(rule, nowIso), nowIso }], [{ type: "update_rule", rule, nowIso }], "ใช้ต่อแล้ว");
  };
  const remove = () => {
    const nowIso = store.nowIso();
    commit([{ type: "delete_rule", id: rule.id, nowIso }], [{ type: "restore_rule", id: rule.id, nowIso }], "ลบแล้ว");
  };

  const blocked = issues.length > 0;
  return (
    <div className="flex flex-col gap-3">
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-muted">ฝั่ง</legend>
        <div className="grid grid-cols-2 gap-1 rounded-full bg-line/60 p-1">
          {(["expense", "income"] as const).map((k) => (
            <label key={k} className="relative">
              <input
                type="radio"
                name={id("kind")}
                checked={form.kind === k}
                onChange={() => set({ kind: k, categoryId: k === "income" ? "other_in" : "other_out", trialEndsOn: k === "income" ? "" : form.trialEndsOn })}
                className="peer absolute inset-0 cursor-pointer opacity-0"
              />
              <span className="flex min-h-10 items-center justify-center rounded-full text-sm peer-checked:bg-card peer-checked:font-semibold peer-checked:text-teal peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-teal">
                {k === "expense" ? "เงินออก" : "เงินเข้า"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="ชื่อ" htmlFor={id("name")}>
        <input id={id("name")} className={inputClass} value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Field label="ยอดต่อครั้ง" htmlFor={id("amount")}>
          <input id={id("amount")} inputMode="decimal" className={`${inputClass} tabular-nums`} value={form.amountText} onChange={(e) => set({ amountText: e.target.value })} />
        </Field>
        <Field label="สกุล" htmlFor={id("currency")}>
          <select id={id("currency")} className={inputClass} value={form.currency} onChange={(e) => set({ currency: e.target.value as Currency })}>
            <option value="THB">บาท</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </Field>
      </div>
      {form.currency !== "THB" && amountMinor !== null && amountMinor > 0 && (
        <p className="-mt-1 text-sm text-muted">
          <MoneyWithThb minor={amountMinor} currency={form.currency} settings={state.settings} /> · คาดการณ์ด้วยเรทในตั้งค่า
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="รอบ" htmlFor={id("cadence")}>
          <select id={id("cadence")} className={inputClass} value={form.cadence} onChange={(e) => set({ cadence: e.target.value as Cadence })}>
            <option value="week">ทุกสัปดาห์</option>
            <option value="month">ทุกเดือน</option>
            <option value="year">ทุกปี</option>
          </select>
        </Field>
        <Field label="ครั้งแรก" htmlFor={id("starts")}>
          <input id={id("starts")} type="date" className={inputClass} value={form.startsOn} onChange={(e) => e.target.value && set({ startsOn: e.target.value })} />
        </Field>
        <Field label="วันสิ้นสุด" htmlFor={id("ends")}>
          <input id={id("ends")} type="date" className={inputClass} value={form.endsOn} onChange={(e) => set({ endsOn: e.target.value })} />
        </Field>
        <Field label="จบหลังกี่ครั้ง" htmlFor={id("max")}>
          <input id={id("max")} inputMode="numeric" className={inputClass} value={form.maxText} onChange={(e) => set({ maxText: e.target.value })} />
        </Field>
      </div>
      {form.kind === "expense" && (
        <Field label="ทดลองใช้ถึง" htmlFor={id("trial")}>
          <input id={id("trial")} type="date" className={inputClass} value={form.trialEndsOn} onChange={(e) => set({ trialEndsOn: e.target.value })} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="หมวด" htmlFor={id("category")}>
          <select id={id("category")} className={inputClass} value={form.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="บัญชี" htmlFor={id("account")}>
          <select id={id("account")} className={inputClass} value={form.accountId} onChange={(e) => set({ accountId: e.target.value })}>
            <option value="">ไม่ระบุ</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.last4 ? ` ••${a.last4}` : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {state.settings.workScopeEnabled && (
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" className="h-5 w-5 accent-teal" checked={form.scope === "work"} onChange={(e) => set({ scope: e.target.checked ? "work" : "personal" })} />
          งาน
        </label>
      )}

      {history && (
        <fieldset className="flex flex-col gap-1 rounded-xl bg-teal-soft p-3 text-sm">
          <legend className="sr-only">ใช้การแก้ไขกับ</legend>
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" name={id("apply")} className="h-5 w-5 accent-teal" checked={applyMode === "next"} onChange={() => setApplyMode("next")} />
            ใช้กับครั้งต่อไป (รอบก่อนวันนี้คงเดิม)
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" name={id("apply")} className="h-5 w-5 accent-teal" checked={applyMode === "all"} onChange={() => setApplyMode("all")} />
            แก้ทุกรอบที่ยังไม่ได้บันทึกจริง
          </label>
          <p className="text-muted">รายการจริงที่บันทึกแล้วไม่เปลี่ยน</p>
        </fieldset>
      )}

      <div className="flex flex-wrap gap-2">
        {active ? (
          <button type="button" onClick={stop} className="min-h-11 rounded-full border border-line bg-card px-4 text-sm font-medium">
            เลิกใช้ (ไม่มีรอบหลังวันนี้)
          </button>
        ) : (
          <button type="button" onClick={resume} className="min-h-11 rounded-full border border-line bg-card px-4 text-sm font-medium">
            ใช้ต่อ
          </button>
        )}
        {!linked &&
          (confirmDelete ? (
            <span role="group" aria-label="ยืนยันลบ" className="flex items-center gap-2">
              <button type="button" onClick={remove} className="min-h-11 rounded-full bg-coral-ink px-4 text-sm font-semibold text-white">
                ลบ
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-11 rounded-full border border-line bg-card px-4 text-sm">
                ไม่ลบ
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-11 rounded-full px-4 text-sm font-medium text-coral-ink hover:bg-coral-soft">
              ลบ
            </button>
          ))}
      </div>
      {linked && <p className="text-sm text-muted">มีรายการจริงผูกอยู่ ใช้ “เลิกใช้” แทนการลบ เพื่อให้ประวัติครบ</p>}
      {rule.endsOn && <p className="text-sm text-muted">ตอนนี้ตั้งจบ {formatThaiShort(rule.endsOn)}</p>}

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-line bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {blocked && (
          <p id={id("issues")} className="text-sm text-coral-ink">
            ยังบันทึกไม่ได้: {issues.join(" · ")}
          </p>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-full border border-line px-4 font-medium hover:bg-paper">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={save}
            disabled={blocked}
            aria-describedby={blocked ? id("issues") : undefined}
            className="min-h-11 flex-1 rounded-full bg-teal px-4 font-semibold text-white disabled:opacity-40"
          >
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
