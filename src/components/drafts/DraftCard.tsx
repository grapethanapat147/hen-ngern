"use client";

import { useId, type ReactNode } from "react";
import { CATEGORIES } from "@/domain/categories";
import { formatThaiShort } from "@/domain/dates";
import { suggestMatches } from "@/domain/matching";
import type { UncertainField } from "@/domain/parser";
import type { AppState, Cadence, Currency, TxKind } from "@/domain/types";
import { CADENCE_LABEL, KIND_LABEL, QUESTIONS } from "@/lib/copy";
import { answerQuestion, changeKind, editDraft, type EditableDraft } from "@/lib/drafts";
import { MoneyWithThb } from "../Money";

interface Props {
  draft: EditableDraft;
  index: number;
  total: number;
  state: AppState;
  today: string;
  issues: string[];
  onChange: (d: EditableDraft) => void;
  onRemove?: () => void;
}

const inputClass =
  "min-h-11 w-full rounded-xl border border-line bg-card px-3 text-base text-ink focus-visible:border-teal disabled:opacity-50";

function Field({ label, flagged, children, htmlFor }: { label: string; flagged?: boolean; children: ReactNode; htmlFor: string }) {
  return (
    <div className={`flex flex-col gap-1 rounded-xl ${flagged ? "bg-amber-soft p-2" : ""}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-muted">
        {label}
        {flagged && <span className="ml-2 font-semibold text-amber-ink">ตรวจช่องนี้</span>}
      </label>
      {children}
    </div>
  );
}

const KINDS: TxKind[] = ["income", "expense", "transfer", "refund"];

export function DraftCard({ draft: d, index, total, state, today, issues, onChange, onRemove }: Props) {
  const uid = useId();
  const id = (f: string) => `${uid}-${f}`;
  const flagged = (f: UncertainField) => d.uncertain.includes(f);
  const set = (field: UncertainField | null, patch: Partial<EditableDraft>) => onChange(editDraft(d, field, patch));
  const accounts = state.accounts.filter((a) => !a.hidden);
  const isTransfer = d.kind === "transfer";
  const recurring = d.cadence !== "once";
  const categories = CATEGORIES.filter((c) => c.kind === (d.kind === "income" ? "income" : "expense"));

  const suggestion =
    !d.match && !d.matchDismissed && !recurring && (d.kind === "income" || d.kind === "expense")
      ? suggestMatches(d, state.rules, {
          today,
          cycleStartDay: state.settings.cycleStartDay,
          transactions: state.transactions,
          settings: state.settings,
        })[0]
      : undefined;

  return (
    <section aria-labelledby={id("title")} className="flex flex-col gap-3 rounded-2xl border border-line bg-paper/60 p-3">
      <div className="flex items-center justify-between">
        <h3 id={id("title")} className="font-semibold">
          {total > 1 ? `ร่าง ${index + 1} จาก ${total}` : "ร่าง"}
        </h3>
        {onRemove && (
          <button type="button" onClick={onRemove} className="min-h-11 px-2 text-sm text-coral-ink underline">
            ไม่บันทึกใบนี้
          </button>
        )}
      </div>

      {d.question && d.kind === null && (
        <div role="group" aria-labelledby={id("q")} className="flex flex-col gap-2 rounded-xl bg-amber-soft p-3">
          <p id={id("q")} className="font-medium">
            {QUESTIONS[d.question].text}
          </p>
          <div className="flex flex-wrap gap-2">
            {(["transfer", "expense"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => onChange(answerQuestion(d, choice, accounts))}
                className="min-h-11 rounded-full border border-teal bg-card px-4 text-sm font-medium text-teal hover:bg-teal-soft"
              >
                {QUESTIONS[d.question!][choice]}
              </button>
            ))}
          </div>
        </div>
      )}

      <fieldset className={`rounded-xl ${flagged("kind") ? "bg-amber-soft p-2" : ""}`}>
        <legend className="mb-1 text-sm font-medium text-muted">
          ชนิด{flagged("kind") && <span className="ml-2 font-semibold text-amber-ink">ตรวจช่องนี้</span>}
        </legend>
        <div className="grid grid-cols-4 gap-1 rounded-full bg-line/60 p-1">
          {KINDS.map((k) => (
            <label key={k} className="relative">
              <input
                type="radio"
                name={id("kind")}
                value={k}
                checked={d.kind === k}
                onChange={() => onChange(changeKind(d, k, accounts))}
                className="peer absolute inset-0 cursor-pointer opacity-0"
              />
              <span className="flex min-h-10 items-center justify-center rounded-full text-sm peer-checked:bg-card peer-checked:font-semibold peer-checked:text-teal peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-teal">
                {KIND_LABEL[k]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {suggestion && (
        <div className="flex flex-col gap-2 rounded-xl bg-teal-soft p-3 text-sm">
          <p>
            ตรงกับ {suggestion.name} วันที่ {formatThaiShort(suggestion.date)} —{" "}
            {suggestion.kind === "income" ? "บันทึกเป็นการรับรอบนี้?" : "บันทึกเป็นการจ่ายรอบนี้?"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="min-h-11 rounded-full bg-teal px-4 font-medium text-white"
              onClick={() =>
                onChange({ ...d, match: { ruleId: suggestion.ruleId, occurrenceDate: suggestion.date, ruleName: suggestion.name } })
              }
            >
              จับคู่
            </button>
            <button type="button" className="min-h-11 rounded-full border border-line bg-card px-4" onClick={() => onChange({ ...d, matchDismissed: true })}>
              ไม่ใช่
            </button>
          </div>
        </div>
      )}
      {d.match && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl bg-teal-soft p-3 text-sm">
          บันทึกเป็น{d.kind === "income" ? "การรับ" : "การจ่าย"}รอบ {d.match.ruleName} วันที่ {formatThaiShort(d.match.occurrenceDate)}
          {!d.lockedMatch && (
            <button type="button" className="min-h-11 px-2 underline" onClick={() => onChange({ ...d, match: undefined, matchDismissed: true })}>
              ยกเลิกการจับคู่
            </button>
          )}
        </p>
      )}

      <Field label="ชื่อ" flagged={flagged("name")} htmlFor={id("name")}>
        <input id={id("name")} className={inputClass} value={d.name} onChange={(e) => set("name", { name: e.target.value })} />
      </Field>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Field label="ยอด" flagged={flagged("amount")} htmlFor={id("amount")}>
          <input
            id={id("amount")}
            inputMode="decimal"
            className={`${inputClass} tabular-nums`}
            value={d.amountText}
            onChange={(e) => set("amount", { amountText: e.target.value })}
          />
        </Field>
        <Field label="สกุล" htmlFor={id("currency")}>
          <select id={id("currency")} className={inputClass} value={d.currency} onChange={(e) => set(null, { currency: e.target.value as Currency })}>
            <option value="THB">บาท</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </Field>
      </div>
      {d.currency !== "THB" && d.amountMinor !== null && d.amountMinor > 0 && (
        <p className="-mt-1 text-sm text-muted">
          <MoneyWithThb minor={d.amountMinor} currency={d.currency} settings={state.settings} /> · ใช้เรทในตั้งค่า
        </p>
      )}

      <Field label={recurring ? "ครั้งแรก" : "วันที่"} flagged={flagged("date")} htmlFor={id("date")}>
        <input id={id("date")} type="date" className={inputClass} value={d.date} onChange={(e) => e.target.value && set("date", { date: e.target.value })} />
      </Field>

      {isTransfer ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="จาก" htmlFor={id("from")}>
            <select id={id("from")} className={inputClass} value={d.fromAccountId ?? ""} onChange={(e) => set(null, { fromAccountId: e.target.value || undefined })}>
              <option value="">เลือกบัญชี</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ไป" htmlFor={id("to")}>
            <select id={id("to")} className={inputClass} value={d.toAccountId ?? ""} onChange={(e) => set(null, { toAccountId: e.target.value || undefined })}>
              <option value="">เลือกบัญชี</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : (
        d.kind !== null && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="หมวด" flagged={flagged("category")} htmlFor={id("category")}>
              <select id={id("category")} className={inputClass} value={d.categoryId ?? ""} onChange={(e) => set("category", { categoryId: e.target.value })}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="บัญชี" flagged={flagged("account")} htmlFor={id("account")}>
              <select id={id("account")} className={inputClass} value={d.accountId ?? ""} onChange={(e) => set("account", { accountId: e.target.value || undefined })}>
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
        )
      )}

      <Field label="รูปแบบ" htmlFor={id("cadence")}>
        <select
          id={id("cadence")}
          className={inputClass}
          value={d.cadence}
          disabled={isTransfer || d.kind === "refund" || d.lockedMatch}
          onChange={(e) => set(null, { cadence: e.target.value as "once" | Cadence })}
        >
          {(Object.keys(CADENCE_LABEL) as (keyof typeof CADENCE_LABEL)[]).map((c) => (
            <option key={c} value={c}>
              {CADENCE_LABEL[c]}
            </option>
          ))}
        </select>
      </Field>

      {recurring && (
        <>
          <p className="rounded-xl bg-teal-soft p-3 text-sm">จะบันทึกเป็นรายการซ้ำ (คาดว่าจะเกิด) ยังไม่นับเป็นเงินจริงจนกว่าจะกดจ่ายแล้ว/ได้รับแล้ว</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="วันสิ้นสุด" htmlFor={id("ends")}>
              <input id={id("ends")} type="date" className={inputClass} value={d.endsOn ?? ""} onChange={(e) => set(null, { endsOn: e.target.value || undefined })} />
            </Field>
            <Field label="จบหลังกี่ครั้ง" htmlFor={id("max")}>
              <input
                id={id("max")}
                inputMode="numeric"
                className={inputClass}
                value={d.maxOccurrences ?? ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  set(null, { maxOccurrences: Number.isInteger(n) && n > 0 ? n : undefined });
                }}
              />
            </Field>
          </div>
          {d.kind === "expense" && (
            <Field label="ทดลองใช้ถึง" htmlFor={id("trial")}>
              <input id={id("trial")} type="date" className={inputClass} value={d.trialEndsOn ?? ""} onChange={(e) => set(null, { trialEndsOn: e.target.value || undefined })} />
            </Field>
          )}
        </>
      )}

      {state.settings.workScopeEnabled && (
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" className="h-5 w-5 accent-teal" checked={d.scope === "work"} onChange={(e) => set(null, { scope: e.target.checked ? "work" : "personal" })} />
          งาน
        </label>
      )}

      {issues.length > 0 && <p className="text-sm text-coral-ink">ขาด: {issues.join(" · ")}</p>}
    </section>
  );
}
