"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Money } from "@/components/Money";
import { SideIncomeCard } from "@/components/overview/Sections";
import { ACCOUNT_TYPES, AccountSheet } from "@/components/settings/AccountSheet";
import { useUi } from "@/components/ui/UiProvider";
import { cycleFor } from "@/domain/cycle";
import { transactionsToCsv } from "@/domain/csv";
import { toResearchExport } from "@/domain/research";
import { parseAmountToMinor } from "@/domain/money";
import { accountBreakdown, cycleTotals, sideIncomeProgress } from "@/domain/totals";
import type { Account, AppState } from "@/domain/types";
import { useBook } from "@/lib/book";
import { POLICY_SHORT } from "@/lib/copy";
import { downloadText } from "@/lib/download";
import { minorToInput } from "@/lib/drafts";

const inputClass = "min-h-11 w-full rounded-xl border border-line bg-card px-3 text-base tabular-nums focus-visible:border-teal";

function Card({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h2 id={id} className="font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A text field that commits on blur or Enter, with inline validation. */
function CommitField({
  label,
  initial,
  parse,
  onCommit,
  hint,
  suffix,
}: {
  label: string;
  initial: string;
  parse: (text: string) => number | null;
  onCommit: (value: number) => void;
  hint?: ReactNode;
  suffix?: string;
}) {
  const id = useId();
  const [text, setText] = useState(initial);
  const [error, setError] = useState(false);
  const commit = () => {
    const value = parse(text);
    if (value === null) {
      setError(true);
      return;
    }
    setError(false);
    if (text !== initial) onCommit(value);
  };
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-muted">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          inputMode="decimal"
          className={inputClass}
          value={text}
          aria-invalid={error}
          aria-describedby={`${id}-msg`}
          onChange={(e) => {
            setText(e.target.value);
          }}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
        />
        {suffix && <span className="shrink-0 text-sm text-muted">{suffix}</span>}
      </div>
      <p id={`${id}-msg`} className={`text-xs ${error ? "text-coral-ink" : "text-muted"}`} role={error ? "alert" : undefined}>
        {error ? "ใส่ตัวเลขที่มากกว่า 0" : hint}
      </p>
    </div>
  );
}

const parseRate = (text: string): number | null => (/^\d+(\.\d{1,4})?$/.test(text.trim()) && Number(text) > 0 ? Number(text) : null);
const parseGoal = (text: string): number | null => {
  const minor = parseAmountToMinor(text);
  return minor !== null && minor > 0 ? minor : null;
};

type Confirming = null | "sample" | "clear" | "research" | { type: "import"; state: AppState };

export default function SettingsPage() {
  const { snapshot, store } = useBook();
  const { toast } = useUi();
  const [editing, setEditing] = useState<Account | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [importError, setImportError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileId = useId();

  if (!snapshot.ready || !snapshot.state || !store) return <div aria-busy="true" className="h-40 animate-pulse rounded-2xl bg-card" />;
  const state = snapshot.state;
  const { settings } = state;
  const today = store.today();
  const cycle = cycleFor(today, settings.cycleStartDay);
  const totals = cycleTotals({ ...state, cycle, today });
  const spend = new Map(accountBreakdown({ transactions: state.transactions, cycle }).map((b) => [b.key, b.amountMinor]));

  const saveSettings = (patch: Partial<AppState["settings"]>) => {
    store.dispatch({ type: "update_settings", settings: patch });
    toast({ message: "บันทึกการตั้งค่าแล้ว" });
  };

  const onFile = async (file: File | undefined) => {
    setImportError(false);
    if (!file) return;
    const result = store.previewImport(await file.text());
    if (fileRef.current) fileRef.current.value = "";
    if (result.ok) setConfirming({ type: "import", state: result.state });
    else setImportError(true);
  };

  const confirmBox = (text: string, action: string, onYes: () => void) => (
    <div role="group" aria-label={text} className="flex flex-col gap-2 rounded-xl bg-coral-soft p-3 text-sm">
      <p className="font-medium text-coral-ink">{text}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            onYes();
            setConfirming(null);
          }}
          className="min-h-11 rounded-full bg-coral-ink px-4 font-semibold text-white"
        >
          {action}
        </button>
        <button type="button" onClick={() => setConfirming(null)} className="min-h-11 rounded-full border border-line bg-card px-4">
          ยกเลิก
        </button>
      </div>
    </div>
  );

  const button = "min-h-11 rounded-full border border-line bg-card px-4 text-sm font-medium hover:border-teal";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">เป้าและตั้งค่า</h1>

      <div className="grid gap-4 nav:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card title="เป้างานเสริมต่อรอบ" id="goal">
            <CommitField
              key={`goal-${settings.sideIncomeGoalMinor}`}
              label="เป้า (บาท)"
              initial={minorToInput(settings.sideIncomeGoalMinor)}
              parse={parseGoal}
              onCommit={(v) => saveSettings({ sideIncomeGoalMinor: v })}
            />
            <SideIncomeCard progress={sideIncomeProgress(totals.sideIncomeMinor, settings.sideIncomeGoalMinor)} />
          </Card>

          <Card title="วันเริ่มรอบ" id="cycle">
            <label htmlFor="cycle-day" className="text-sm font-medium text-muted">
              เริ่มรอบทุกวันที่
            </label>
            <select
              id="cycle-day"
              className={inputClass}
              value={settings.cycleStartDay}
              onChange={(e) => saveSettings({ cycleStartDay: Number(e.target.value) })}
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted">ถ้าเงินเดือนออกวันที่ 25 ให้ตั้ง 25 รอบจะเป็น 25 ถึง 24 ของเดือนถัดไป</p>
          </Card>

          <Card title="เรทแลกเปลี่ยน" id="fx">
            <div className="grid grid-cols-2 gap-2">
              <CommitField
                key={`usd-${settings.fx.USD}`}
                label="USD → บาท"
                initial={String(settings.fx.USD)}
                parse={parseRate}
                onCommit={(v) => saveSettings({ fx: { ...settings.fx, USD: v } })}
              />
              <CommitField
                key={`eur-${settings.fx.EUR}`}
                label="EUR → บาท"
                initial={String(settings.fx.EUR)}
                parse={parseRate}
                onCommit={(v) => saveSettings({ fx: { ...settings.fx, EUR: v } })}
              />
            </div>
            <p className="text-sm text-muted">เรทนี้ตั้งเอง ไม่ใช่เรทเข้าบัญชี · รายการที่บันทึกแล้วใช้เรท ณ วันบันทึก</p>
          </Card>

          <Card title="ป้ายงาน" id="work">
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="h-5 w-5 accent-teal"
                checked={settings.workScopeEnabled}
                onChange={(e) => saveSettings({ workScopeEnabled: e.target.checked })}
              />
              ใช้ป้าย “งาน” แยกเงินงานกับเงินส่วนตัว
            </label>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card title="บัญชี" id="accounts">
            <ul className="divide-y divide-line">
              {state.accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ background: a.color ?? "var(--muted)" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {a.name}
                      {a.last4 ? ` ••${a.last4}` : ""}
                      {a.hidden && <span className="ml-2 text-xs text-muted">(ซ่อน)</span>}
                    </span>
                    <span className="text-xs text-muted">
                      {ACCOUNT_TYPES.find((t) => t.value === a.type)?.label} · จ่ายจริงรอบนี้ <Money minor={spend.get(a.id) ?? 0} />
                    </span>
                  </span>
                  <button type="button" onClick={() => setEditing(a)} className="min-h-11 shrink-0 rounded-full border border-line px-4 text-sm">
                    แก้ไข<span className="sr-only"> {a.name}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setEditing({ id: crypto.randomUUID(), name: "", type: "credit_card" })} className={`${button} self-start`}>
              + บัญชี
            </button>
          </Card>

          <Card title="ข้อมูล" id="data">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={button}
                onClick={() => downloadText(store.exportJson() ?? "", `henngern-backup-${today}.json`, "application/json")}
              >
                ส่งออก JSON
              </button>
              <label htmlFor={fileId} className={`${button} inline-flex cursor-pointer items-center`}>
                นำเข้า JSON
              </label>
              <input id={fileId} ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
              <button type="button" className={button} onClick={() => downloadText(transactionsToCsv(state), `henngern-${today}.csv`, "text/csv;charset=utf-8")}>
                ส่งออก CSV
              </button>
              <button type="button" className={button} onClick={() => setConfirming("research")}>
                ส่งออกสำหรับงานวิจัย
              </button>
              <button type="button" className={button} onClick={() => setConfirming("sample")}>
                โหลดข้อมูลตัวอย่าง
              </button>
              <button type="button" className={`${button} text-coral-ink`} onClick={() => setConfirming("clear")}>
                ล้างข้อมูลในเครื่อง
              </button>
            </div>
            {importError && (
              <p role="alert" className="text-sm text-coral-ink">
                ไฟล์นี้อ่านไม่ได้ หรือไม่ใช่ไฟล์สำรองของเห็นเงิน ข้อมูลเดิมยังอยู่ครบ
              </p>
            )}
            {confirming && typeof confirming === "object" &&
              confirmBox(
                `นำเข้าไฟล์นี้จะแทนที่ข้อมูลทั้งหมดในเครื่อง (รายการ ${confirming.state.transactions.filter((t) => !t.deletedAt).length} · รายการซ้ำ ${confirming.state.rules.filter((r) => !r.deletedAt).length} · บัญชี ${confirming.state.accounts.length})`,
                "นำเข้า",
                () => {
                  store.dispatch({ type: "replace", state: confirming.state });
                  toast({ message: "นำเข้าแล้ว" });
                },
              )}
            {confirming === "research" &&
              (() => {
                const research = toResearchExport(state, { today });
                const preview = { ...research, transactions: research.transactions.slice(0, 2), rules: research.rules.slice(0, 1) };
                return (
                  <div role="group" aria-label="ส่งออกสำหรับงานวิจัย" data-testid="research-panel" className="flex flex-col gap-2 rounded-xl bg-teal-soft p-3 text-sm">
                    <p className="font-semibold">ไฟล์สำหรับส่งให้ทีมวิจัย (เฉพาะคนที่ยินยอม)</p>
                    <p>
                      <span className="font-medium">ไม่มี:</span> ชื่อรายการ · หมายเหตุ · ยอดเงิน · เรท · ชื่อบัญชี · 4 ตัวท้าย · วันที่จริงและเวลา
                    </p>
                    <p>
                      <span className="font-medium">มี:</span> ชนิด · หมวด (สุขภาพรวมอยู่ใน อื่น ๆ) · ลำดับวันนับจากวันแรกที่จด · สกุลเงิน · ประเภทบัญชี · ช่องที่ต้องแก้จากร่าง
                    </p>
                    <p className="text-muted">
                      รายการที่คุณจดเอง {research.summary.confirmedCount} รายการ · จด {research.summary.activeDays} วัน
                      {state.isSample && " · ตอนนี้เป็นข้อมูลตัวอย่าง ไฟล์จะยังไม่มีข้อมูลการใช้งานของคุณ"}
                    </p>
                    <details>
                      <summary className="min-h-11 cursor-pointer content-center font-medium">ดูตัวอย่างข้อมูลในไฟล์</summary>
                      <pre className="max-h-64 overflow-auto rounded-lg bg-card p-2 text-xs whitespace-pre-wrap">{JSON.stringify(preview, null, 2)}</pre>
                    </details>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="min-h-11 rounded-full bg-teal px-4 font-semibold text-white"
                        onClick={() => {
                          downloadText(JSON.stringify(research, null, 2), `henngern-research-${today}.json`, "application/json");
                          setConfirming(null);
                        }}
                      >
                        ดาวน์โหลดไฟล์วิจัย
                      </button>
                      <button type="button" onClick={() => setConfirming(null)} className="min-h-11 rounded-full border border-line bg-card px-4">
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                );
              })()}
            {confirming === "sample" &&
              confirmBox("แทนที่ข้อมูลทั้งหมดในเครื่องด้วยข้อมูลตัวอย่าง?", "โหลดตัวอย่าง", () => {
                store.loadSample();
                toast({ message: "โหลดข้อมูลตัวอย่างแล้ว" });
              })}
            {confirming === "clear" &&
              confirmBox("ลบข้อมูลทั้งหมดในเครื่องนี้? ถ้าไม่ได้ส่งออกไว้จะกู้คืนไม่ได้", "ล้างข้อมูล", () => {
                store.clearAll();
                toast({ message: "ล้างข้อมูลแล้ว" });
              })}
            <p className="text-xs text-muted">ไฟล์ CSV เป็น UTF-8 เปิดใน Excel หรือ Google Sheets ได้ · ยอดบาทใช้เรทที่ล็อกไว้ ณ วันบันทึก</p>
          </Card>

          <Card title="นโยบาย" id="policy">
            <p className="text-sm">{POLICY_SHORT} · ไม่เก็บเลขบัตรเต็ม · ข้อมูลไม่ขึ้นคลาวด์</p>
            <p className="text-xs text-muted">ข้อมูลทั้งหมดอยู่ในเบราว์เซอร์นี้เท่านั้น ควรส่งออก JSON เก็บไว้เป็นระยะ</p>
          </Card>
        </div>
      </div>

      <AccountSheet
        account={editing}
        onClose={() => setEditing(null)}
        onSave={(a) => {
          store.dispatch({ type: "upsert_account", account: a });
          setEditing(null);
          toast({ message: "บันทึกแล้ว" });
        }}
      />
    </div>
  );
}
