// Parser cases P1–P18 — docs/03-parser-spec.md §4. Never edit expected values to make a test pass.
import { describe, expect, it } from "vitest";
import { draftIssues, parseSentence } from "../parser";
import type { Account } from "../types";
import { settings } from "./fixtures";

const accounts: Account[] = [
  { id: "kbank", name: "KBank Visa", type: "credit_card", last4: "4529" },
  { id: "scb", name: "SCB Mastercard", type: "credit_card", last4: "8812" },
  { id: "tmn", name: "TrueMoney", type: "wallet", last4: "7127" },
  { id: "cash", name: "เงินสด", type: "cash" },
];
const ctx = { today: "2026-10-01", accounts, settings: settings() };
const parse = (text: string) => parseSentence(text, ctx);
const one = (text: string) => {
  const drafts = parse(text);
  expect(drafts).toHaveLength(1);
  return drafts[0];
};

describe("parser P1–P18", () => {
  it("P1 ได้ค่างาน 4500", () => {
    expect(one("ได้ค่างาน 4500")).toMatchObject({
      kind: "income",
      amountMinor: 450_000,
      currency: "THB",
      categoryId: "side",
      cadence: "once",
      date: "2026-10-01",
      name: "ค่างาน",
    });
  });

  it("P2 จ่าย Netflix 419 ทุกเดือนวันที่ 5 บัตรกสิกร", () => {
    expect(one("จ่าย Netflix 419 ทุกเดือนวันที่ 5 บัตรกสิกร")).toMatchObject({
      kind: "expense",
      amountMinor: 41_900,
      categoryId: "entertainment",
      cadence: "month",
      date: "2026-10-05",
      dayOfMonth: 5,
      accountId: "kbank",
      name: "Netflix",
    });
  });

  it("P3 ทดลอง Perplexity 20 ดอลลาร์ ถึง 2 ต.ค.", () => {
    expect(one("ทดลอง Perplexity 20 ดอลลาร์ ถึง 2 ต.ค.")).toMatchObject({
      kind: "expense",
      amountMinor: 2_000,
      currency: "USD",
      categoryId: "software",
      cadence: "month",
      trialEndsOn: "2026-10-02",
      date: "2026-10-02",
      name: "Perplexity",
    });
  });

  it("P4 เงินเดือนเข้า 35000 kbank — k in kbank is not ×1000, and salary is not a cadence", () => {
    expect(one("เงินเดือนเข้า 35000 kbank")).toMatchObject({
      kind: "income",
      amountMinor: 3_500_000,
      categoryId: "salary",
      cadence: "once",
      accountId: "kbank",
      name: "เงินเดือน",
    });
  });

  it("P5 two items in one sentence", () => {
    const drafts = parse("กาแฟ 65 tmn, ข้าวมันไก่ 50 เงินสด");
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({ amountMinor: 6_500, categoryId: "food", accountId: "tmn", name: "กาแฟ" });
    expect(drafts[1]).toMatchObject({ amountMinor: 5_000, categoryId: "food", accountId: "cash", name: "ข้าวมันไก่" });
  });

  it("P6 โอน 5,000 จากกสิกรไป SCB", () => {
    const d = one("โอน 5,000 จากกสิกรไป SCB");
    expect(d).toMatchObject({ kind: "transfer", amountMinor: 500_000, fromAccountId: "kbank", toAccountId: "scb" });
    expect(d.question).toBeUndefined();
  });

  it("P7 โอน 2500 asks transfer or expense", () => {
    expect(one("โอน 2500")).toMatchObject({ kind: null, amountMinor: 250_000, question: "transfer_or_expense" });
  });

  it("P8 จ่ายบัตร 8,000 asks card payment or expense", () => {
    expect(one("จ่ายบัตร 8,000")).toMatchObject({ kind: null, amountMinor: 800_000, question: "card_payment_or_expense" });
  });

  it("P9 แท็กซี่ 220 เมื่อวาน", () => {
    const d = one("แท็กซี่ 220 เมื่อวาน");
    expect(d).toMatchObject({ kind: "expense", amountMinor: 22_000, categoryId: "transport", date: "2026-09-30" });
    expect(d.uncertain).toContain("kind");
  });

  it("P10 ได้เงินคืน grab 50", () => {
    expect(one("ได้เงินคืน grab 50")).toMatchObject({ kind: "refund", amountMinor: 5_000, categoryId: "transport" });
  });

  it("P11 Claude 20$ ทุกเดือน 4529 — last4 picks the account and is not the amount", () => {
    expect(one("Claude 20$ ทุกเดือน 4529")).toMatchObject({
      kind: "expense",
      amountMinor: 2_000,
      currency: "USD",
      categoryId: "software",
      cadence: "month",
      accountId: "kbank",
      name: "Claude",
    });
  });

  it("P12 ค่าเช่า 6.5k ทุกเดือนวันที่ 1", () => {
    expect(one("ค่าเช่า 6.5k ทุกเดือนวันที่ 1")).toMatchObject({
      kind: "expense",
      amountMinor: 650_000,
      categoryId: "home",
      cadence: "month",
      date: "2026-10-01",
      name: "ค่าเช่า",
    });
  });

  it("P13 iCloud 1,188 ทุกปี", () => {
    expect(one("iCloud 1,188 ทุกปี")).toMatchObject({
      kind: "expense",
      amountMinor: 118_800,
      categoryId: "cloud",
      cadence: "year",
      name: "iCloud",
    });
  });

  it("P14 ส้มตำ ๖๐ — Thai digits", () => {
    expect(one("ส้มตำ ๖๐")).toMatchObject({ kind: "expense", amountMinor: 6_000, categoryId: "food" });
  });

  it("P15 ไปกินข้าว — no number, no draft", () => {
    expect(parse("ไปกินข้าว")).toEqual([]);
  });

  it("P16 ค่างาน 1.5 หมื่น — ค่า + income category is income, but uncertain", () => {
    const d = one("ค่างาน 1.5 หมื่น");
    expect(d).toMatchObject({ kind: "income", amountMinor: 1_500_000, categoryId: "side" });
    expect(d.uncertain).toContain("kind");
  });

  it("P17 grab food 189 is food, not transport", () => {
    expect(one("grab food 189")).toMatchObject({ kind: "expense", amountMinor: 18_900, categoryId: "food" });
  });

  it("P18 จ่าย 0 — one draft that cannot be saved", () => {
    const d = one("จ่าย 0");
    expect(d.uncertain).toContain("amount");
    expect(draftIssues(d)).toContain("ยอดต้องมากกว่า 0");
  });
});

describe("parser edge cases", () => {
  it("unknown account falls back to cash and is flagged", () => {
    const d = one("กาแฟ 65");
    expect(d.accountId).toBe("cash");
    expect(d.uncertain).toContain("account");
  });

  it("unknown category falls back to other and is flagged", () => {
    const d = one("จ่ายของขวัญ 500");
    expect(d.categoryId).toBe("other_out");
    expect(d.uncertain).toContain("category");
  });

  it("Buddhist-era year is converted", () => {
    expect(one("จ่ายค่าไฟ 800 5 ต.ค. 2569").date).toBe("2026-10-05");
  });

  it("a past date in a recurring rule rolls to next year", () => {
    expect(one("ค่าโดเมน 500 ทุกปี 15 ก.ย.").date).toBe("2027-09-15");
  });

  it("monthly day already passed starts next month", () => {
    const d = parseSentence("ค่าเน็ต 599 ทุกเดือนวันที่ 3", { ...ctx, today: "2026-10-10" })[0];
    expect(d.date).toBe("2026-11-03");
  });

  it("7-11 is a keyword, not the amount", () => {
    expect(one("7-11 85")).toMatchObject({ amountMinor: 8_500, categoryId: "food" });
  });

  it("draftIssues lists what is missing", () => {
    expect(draftIssues(one("โอน 2500"))).toContain("ตอบคำถามก่อนบันทึก");
    expect(draftIssues(one("ได้ค่างาน 4500"))).toEqual([]);
  });

  it("splits on newline and และ", () => {
    expect(parse("กาแฟ 65\nข้าว 50 และ ขนม 20")).toHaveLength(3);
  });
});
