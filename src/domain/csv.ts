import { categoryName } from "./categories";
import { txThbMinor } from "./money";
import type { AppState, Transaction } from "./types";

// CSV export (D14): UTF-8 with BOM and CRLF so Excel and Google Sheets read Thai correctly.

const BOM = "﻿";
const KIND = { income: "รายรับ", expense: "รายจ่าย", transfer: "โอน", refund: "คืนเงิน" } as const;

export const CSV_HEADER = ["วันที่", "ชนิด", "ชื่อ", "ยอด", "สกุล", "เรท", "ยอดบาท", "หมวด", "บัญชี", "จากบัญชี", "ไปบัญชี", "ขอบเขต", "รายการซ้ำ", "หมายเหตุ", "ที่มา"];

const minorText = (minor: number) => {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
};

/** Quote when needed; neutralise spreadsheet formulas (=, +, -, @ at the start of text). */
export function csvCell(value: string): string {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function transactionsToCsv(state: AppState): string {
  const account = (id?: string) => state.accounts.find((a) => a.id === id)?.name ?? "";
  const rule = (id?: string) => state.rules.find((r) => r.id === id)?.name ?? "";
  const rows = state.transactions
    .filter((t) => !t.deletedAt)
    .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? -1 : 1) : a.date < b.date ? -1 : 1))
    .map((t: Transaction) => {
      const cells = [
        t.date,
        KIND[t.kind],
        t.name,
        minorText(t.amountMinor),
        t.currency,
        String(t.fxRateToThb),
        minorText(txThbMinor(t)),
        t.kind === "transfer" ? "" : categoryName(t.categoryId),
        account(t.accountId),
        account(t.fromAccountId),
        account(t.toAccountId),
        t.scope === "work" ? "งาน" : "ส่วนตัว",
        rule(t.recurringRuleId),
        t.note ?? "",
        t.source,
      ];
      return cells.map(csvCell).join(",");
    });
  return BOM + [CSV_HEADER.join(","), ...rows].join("\r\n") + "\r\n";
}
