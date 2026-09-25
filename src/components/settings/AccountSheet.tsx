"use client";

import { useId, useState } from "react";
import type { Account, AccountType } from "@/domain/types";
import { Sheet } from "../ui/Sheet";

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "credit_card", label: "บัตรเครดิต" },
  { value: "bank", label: "บัญชีธนาคาร" },
  { value: "wallet", label: "วอลเล็ต" },
  { value: "cash", label: "เงินสด" },
  { value: "promptpay", label: "พร้อมเพย์" },
];

const COLORS = ["#0B6B66", "#3D6B4F", "#243044", "#C24B3A", "#8A5A00", "#6B6458"];
const COLOR_NAMES = ["เขียวน้ำทะเล", "เขียวใบไม้", "กรมท่า", "ปะการัง", "อำพัน", "เทา"];
const hasLast4 = (t: AccountType) => t === "credit_card" || t === "wallet";
const inputClass = "min-h-11 w-full rounded-xl border border-line bg-card px-3 text-base focus-visible:border-teal";

/** Account form. Only the last 4 digits are ever asked for — no full number, CVV or expiry (A-20). */
export function AccountSheet({ account, onClose, onSave }: { account: Account | null; onClose: () => void; onSave: (a: Account) => void }) {
  return (
    <Sheet open={account !== null} onClose={onClose} title={account?.name ? "แก้ไขบัญชี" : "เพิ่มบัญชี"}>
      {account && <AccountForm key={account.id} account={account} onClose={onClose} onSave={onSave} />}
    </Sheet>
  );
}

function AccountForm({ account, onClose, onSave }: { account: Account; onClose: () => void; onSave: (a: Account) => void }) {
  const uid = useId();
  const [form, setForm] = useState({
    name: account.name,
    type: account.type,
    last4: account.last4 ?? "",
    color: account.color ?? COLORS[0],
    hidden: account.hidden ?? false,
  });
  const issues: string[] = [];
  if (!form.name.trim()) issues.push("ใส่ชื่อบัญชี");
  if (hasLast4(form.type) && form.last4 && !/^\d{4}$/.test(form.last4)) issues.push("4 ตัวท้ายต้องเป็นตัวเลข 4 หลัก");

  const save = () => {
    const next: Account = { id: account.id, name: form.name.trim(), type: form.type, color: form.color };
    if (hasLast4(form.type) && form.last4) next.last4 = form.last4;
    if (form.hidden) next.hidden = true;
    onSave(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-name`} className="text-sm font-medium text-muted">
          ชื่อบัญชี
        </label>
        <input id={`${uid}-name`} className={inputClass} value={form.name} placeholder="เช่น KBank Visa" onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-type`} className="text-sm font-medium text-muted">
          ประเภท
        </label>
        <select id={`${uid}-type`} className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      {hasLast4(form.type) && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-last4`} className="text-sm font-medium text-muted">
            4 ตัวท้าย (ไม่บังคับ)
          </label>
          <input
            id={`${uid}-last4`}
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            pattern="\d{4}"
            className={`${inputClass} tabular-nums`}
            value={form.last4}
            onChange={(e) => setForm({ ...form, last4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          />
          <p className="text-xs text-muted">เก็บแค่ 4 ตัวท้ายไว้ช่วยจำ ไม่ขอเลขบัตรเต็ม</p>
        </div>
      )}
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium text-muted">สีการ์ด</legend>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c, i) => (
            <label key={c} className="relative">
              <input type="radio" name={`${uid}-color`} checked={form.color === c} onChange={() => setForm({ ...form, color: c })} className="peer sr-only" />
              <span className="sr-only">{COLOR_NAMES[i]}</span>
              <span
                aria-hidden="true"
                className="block h-11 w-11 cursor-pointer rounded-full border-4 border-card ring-2 ring-transparent peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-teal"
                style={{ background: c }}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" className="h-5 w-5 accent-teal" checked={form.hidden} onChange={(e) => setForm({ ...form, hidden: e.target.checked })} />
        ซ่อนบัญชีนี้ (รายการเดิมยังอยู่)
      </label>
      {issues.length > 0 && <p className="text-sm text-coral-ink">ยังบันทึกไม่ได้: {issues.join(" · ")}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-full border border-line px-4 font-medium">
          ยกเลิก
        </button>
        <button type="button" onClick={save} disabled={issues.length > 0} className="min-h-11 flex-1 rounded-full bg-teal px-4 font-semibold text-white disabled:opacity-40">
          บันทึก
        </button>
      </div>
    </div>
  );
}
