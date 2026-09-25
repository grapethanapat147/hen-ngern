import { categoryById, categoryName } from "../categories";
import {
  addDays,
  clampedDate,
  daysInMonth,
  parseLocalDate,
  THAI_MONTHS_FULL,
  THAI_MONTHS_SHORT,
  toCommonEraYear,
} from "../dates";
import { parseAmountToMinor } from "../money";
import type { Account, Cadence, Currency, LocalDate, Scope, Settings } from "../types";
import { accountAliases, CATEGORY_KEYWORD_LIST } from "./lexicon";

// Rule-based Thai sentence → draft(s). docs/03-parser-spec.md. Output is always a draft for the user to confirm.

export type UncertainField = "kind" | "amount" | "name" | "category" | "account" | "date";
export type DraftQuestion = "card_payment_or_expense" | "transfer_or_expense";

export interface Draft {
  kind: "income" | "expense" | "transfer" | "refund" | null;
  name: string;
  amountMinor: number | null;
  currency: Currency;
  /** Once: the transaction date. Recurring: startsOn. */
  date: LocalDate;
  cadence: "once" | Cadence;
  dayOfMonth?: number;
  trialEndsOn?: LocalDate;
  categoryId?: string;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  scope: Scope;
  uncertain: UncertainField[];
  question?: DraftQuestion;
}

export interface ParseContext {
  today: LocalDate;
  accounts: Account[];
  settings: Settings;
}

// ---------------------------------------------------------------------------
// Normalisation keeps two same-length strings: `norm` for matching (lower-case latin)
// and `text` for display (original case), so spans found in one apply to the other.

interface Source {
  norm: string;
  text: string;
}

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

function normalize(raw: string): Source {
  const chars = [...raw].map((c) => {
    const i = THAI_DIGITS.indexOf(c);
    if (i >= 0) return String(i);
    return c === "\r" || c === "\t" || c === " " ? " " : c;
  });
  const keep: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === "," && /\d/.test(chars[i - 1] ?? "") && /\d/.test(chars[i + 1] ?? "")) continue;
    if (c === " " && (keep.length === 0 || keep[keep.length - 1] === " " || keep[keep.length - 1] === "\n")) continue;
    if (c === "\n" && keep[keep.length - 1] === " ") keep.pop();
    keep.push(c);
  }
  const text = keep.join("");
  return { text, norm: text.replace(/[A-Z]/g, (c) => c.toLowerCase()) };
}

function splitItems(src: Source): Source[] {
  const out: Source[] = [];
  const re = /[\n,;]| และ /g;
  let last = 0;
  for (const m of src.norm.matchAll(re)) {
    out.push(slice(src, last, m.index));
    last = m.index + m[0].length;
  }
  out.push(slice(src, last, src.norm.length));
  return out.filter((s) => s.norm.trim() !== "");
}

function slice(src: Source, start: number, end: number): Source {
  return { norm: src.norm.slice(start, end), text: src.text.slice(start, end) };
}

// ---------------------------------------------------------------------------
// Span bookkeeping: `removed` chars are dropped from the name; `protectedChars` are
// excluded from amount detection only (e.g. the digits in "7-11").

class Segment {
  readonly removed: boolean[];
  readonly protectedChars: boolean[];
  constructor(readonly src: Source) {
    this.removed = new Array(src.norm.length).fill(false);
    this.protectedChars = new Array(src.norm.length).fill(false);
  }
  get norm() {
    return this.src.norm;
  }
  remove(start: number, end: number) {
    for (let i = start; i < end; i++) this.removed[i] = true;
  }
  isFree(start: number, end: number) {
    for (let i = start; i < end; i++) if (this.removed[i] || this.protectedChars[i]) return false;
    return true;
  }
  /** First unremoved match of `re` (must be global). */
  find(re: RegExp): RegExpMatchArray | undefined {
    for (const m of this.norm.matchAll(re)) {
      const start = m.index ?? 0;
      if (this.isFree(start, start + m[0].length)) return m;
    }
    return undefined;
  }
  leftover(): string {
    return [...this.src.text].filter((_, i) => !this.removed[i]).join("");
  }
}

const LATIN = /[a-z0-9]/;

/** Latin keywords must not touch other latin letters/digits ("true" ≠ "truemoney", "k" ≠ "kbank"). */
function boundaryOk(norm: string, start: number, end: number, word: string): boolean {
  if (LATIN.test(word[0]) && LATIN.test(norm[start - 1] ?? "")) return false;
  if (LATIN.test(word[word.length - 1]) && LATIN.test(norm[end] ?? "")) return false;
  return true;
}

function indexOfWord(norm: string, word: string, from = 0): number {
  let i = norm.indexOf(word, from);
  while (i >= 0) {
    if (boundaryOk(norm, i, i + word.length, word)) return i;
    i = norm.indexOf(word, i + 1);
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Dates

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MONTH_WORDS: { pattern: string; month: number }[] = [
  ...THAI_MONTHS_FULL.map((w, i) => ({ pattern: escape(w), month: i + 1 })),
  ...THAI_MONTHS_SHORT.map((w, i) => ({ pattern: escape(w).replace(/\\\.$/, "\\.?"), month: i + 1 })),
];
const MONTH_ALT = MONTH_WORDS.map((m) => m.pattern).join("|");
const MONTH_LOOKUP = MONTH_WORDS.map((m) => ({ re: new RegExp(`^(?:${m.pattern})$`), month: m.month }));

const FULL_DATE_RE = new RegExp(`(?:ถึง\\s*)?(?:วันที่\\s*)?(?<![\\d.])(\\d{1,2})\\s*(${MONTH_ALT})(?:\\s*(\\d{4}))?(?!\\d)`, "g");
const SLASH_DATE_RE = /(?:ถึง\s*)?(?<![\d.])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\d/])/g;
const DAY_OF_MONTH_RE = /วันที่\s*(\d{1,2})(?!\d)/g;
const RELATIVE: [RegExp, number][] = [
  [/เมื่อวานซืน/g, -2],
  [/เมื่อวาน/g, -1],
  [/วันนี้/g, 0],
  [/พรุ่งนี้/g, 1],
];

interface DateInfo {
  explicit?: { y?: number; m: number; d: number };
  relativeDays?: number;
  dayOfMonth?: number;
}

function twoDigitYear(y: number): number {
  // "69" is far more likely พ.ศ. 2569 than ค.ศ. 2069 for Thai users.
  return y >= 60 ? 2500 + y : 2000 + y;
}

function extractDate(seg: Segment): DateInfo {
  const full = seg.find(FULL_DATE_RE);
  if (full) {
    const month = MONTH_LOOKUP.find((l) => l.re.test(full[2]))?.month;
    if (month) {
      seg.remove(full.index!, full.index! + full[0].length);
      return { explicit: { d: Number(full[1]), m: month, y: full[3] ? toCommonEraYear(Number(full[3])) : undefined } };
    }
  }
  const slash = seg.find(SLASH_DATE_RE);
  if (slash) {
    const d = Number(slash[1]);
    const m = Number(slash[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      seg.remove(slash.index!, slash.index! + slash[0].length);
      const rawYear = slash[3] ? Number(slash[3]) : undefined;
      const y = rawYear === undefined ? undefined : toCommonEraYear(rawYear < 100 ? twoDigitYear(rawYear) : rawYear);
      return { explicit: { d, m, y } };
    }
  }
  const info: DateInfo = {};
  const dom = seg.find(DAY_OF_MONTH_RE);
  if (dom) {
    const n = Number(dom[1]);
    if (n >= 1 && n <= 31) {
      seg.remove(dom.index!, dom.index! + dom[0].length);
      info.dayOfMonth = n;
    }
  }
  for (const [re, offset] of RELATIVE) {
    const m = seg.find(re);
    if (m) {
      seg.remove(m.index!, m.index! + m[0].length);
      info.relativeDays = offset;
      break;
    }
  }
  return info;
}

function resolveDate(info: DateInfo, today: LocalDate, rollForward: boolean): { date: LocalDate; dayOfMonth?: number } {
  const t = parseLocalDate(today);
  if (info.explicit) {
    const { d, m } = info.explicit;
    let y = info.explicit.y ?? t.y;
    let date = clampedDate(y, m, d);
    if (rollForward && info.explicit.y === undefined && date < today) {
      y += 1;
      date = clampedDate(y, m, d);
    }
    return { date, dayOfMonth: rollForward ? d : undefined };
  }
  if (info.relativeDays !== undefined) return { date: addDays(today, info.relativeDays) };
  if (info.dayOfMonth !== undefined) {
    const n = info.dayOfMonth;
    if (!rollForward || n >= t.d) {
      return { date: clampedDate(t.y, t.m, Math.min(n, daysInMonth(t.y, t.m))), dayOfMonth: n };
    }
    return { date: clampedDate(t.y, t.m + 1, n), dayOfMonth: n };
  }
  return { date: today };
}

// ---------------------------------------------------------------------------
// Accounts

interface AccountHit {
  account: Account;
  start: number;
  end: number;
}

function findAccount(seg: Segment, accounts: Account[], from = 0, to = seg.norm.length): AccountHit | undefined {
  let best: AccountHit | undefined;
  const region = seg.norm.slice(0, to);
  for (const account of accounts) {
    for (const alias of accountAliases(account)) {
      let i = indexOfWord(region, alias, from);
      while (i >= 0 && !seg.isFree(i, i + alias.length)) i = indexOfWord(region, alias, i + 1);
      if (i < 0) continue;
      const hit = { account, start: i, end: i + alias.length };
      if (!best || hit.start < best.start || (hit.start === best.start && hit.end > best.end)) best = hit;
    }
  }
  return best;
}

/** Remove an account mention plus a directly preceding "บัตร" / "เข้า" / "จาก" / "ไป". */
function removeAccountMention(seg: Segment, hit: AccountHit) {
  let start = hit.start;
  const before = seg.norm.slice(0, start);
  const lead = /(บัตร|เข้า|จาก|ไป)\s*$/.exec(before);
  if (lead) start -= lead[0].length;
  seg.remove(start, hit.end);
}

const EXPLICIT_LAST4_RE = /(?:•{2,4}|\*{2,4}|x{4}|ลงท้าย)\s*(\d{4})(?!\d)/g;

// ---------------------------------------------------------------------------
// Amount & currency

const CURRENCY_MARKERS: [RegExp, Currency][] = [
  [/ดอลลาร์|ดอล|\$|(?<![a-z])usd(?![a-z])/g, "USD"],
  [/ยูโร|€|(?<![a-z])eur(?![a-z])/g, "EUR"],
];

const MULTIPLIERS: Record<string, number> = { k: 1_000, พัน: 1_000, หมื่น: 10_000, แสน: 100_000 };
const MULTIPLIER_RE = /^\s*(k(?![a-z])|พัน|หมื่น|แสน)/;

function extractCurrency(seg: Segment): Currency {
  for (const [re, currency] of CURRENCY_MARKERS) {
    const matches = [...seg.norm.matchAll(re)];
    if (matches.length === 0) continue;
    for (const m of matches) seg.remove(m.index!, m.index! + m[0].length);
    return currency;
  }
  return "THB";
}

interface AmountHit {
  minor: number | null;
}

function extractAmount(seg: Segment, accounts: Account[]): { amount?: AmountHit; last4Account?: Account } {
  const candidates: { start: number; end: number; raw: string }[] = [];
  for (const m of seg.norm.matchAll(/\d+(?:\.\d+)?/g)) {
    const start = m.index!;
    const end = start + m[0].length;
    if (!seg.isFree(start, end)) continue;
    if (/[a-z]/.test(seg.norm[start - 1] ?? "")) continue;
    candidates.push({ start, end, raw: m[0] });
  }
  let last4Account: Account | undefined;
  if (candidates.length > 1) {
    const idx = candidates.findIndex((c) => c.raw.length === 4 && accounts.some((a) => a.last4 === c.raw));
    if (idx >= 0) {
      const c = candidates[idx];
      last4Account = accounts.find((a) => a.last4 === c.raw);
      seg.remove(c.start, c.end);
      candidates.splice(idx, 1);
    }
  }
  const first = candidates[0];
  if (!first) return { last4Account };
  let end = first.end;
  let factor = 1;
  const mult = MULTIPLIER_RE.exec(seg.norm.slice(end));
  if (mult) {
    factor = MULTIPLIERS[mult[1]];
    end += mult[0].length;
  }
  seg.remove(first.start, end);
  const base = parseAmountToMinor(first.raw);
  return { amount: { minor: base === null ? null : base * factor }, last4Account };
}

// ---------------------------------------------------------------------------
// Kind, cadence, category

const CADENCES: [RegExp, Cadence][] = [
  [/ทุกเดือน|รายเดือน|เดือนละ/g, "month"],
  [/ทุกปี|รายปี|ปีละ/g, "year"],
  [/ทุกสัปดาห์|รายสัปดาห์|ทุกอาทิตย์|อาทิตย์ละ/g, "week"],
];

function extractCadence(seg: Segment): "once" | Cadence {
  for (const [re, cadence] of CADENCES) {
    const m = seg.find(re);
    if (m) {
      seg.remove(m.index!, m.index! + m[0].length);
      return cadence;
    }
  }
  return "once";
}

function findCategory(seg: Segment): { categoryId: string; start: number; end: number } | undefined {
  let best: { categoryId: string; start: number; end: number } | undefined;
  for (const { keyword, categoryId } of CATEGORY_KEYWORD_LIST) {
    const i = indexOfWord(seg.norm, keyword);
    if (i < 0) continue;
    // Longest keyword wins; list is sorted, so only replace on a strictly earlier, equally long hit.
    if (!best || (keyword.length === best.end - best.start && i < best.start)) {
      best = { categoryId, start: i, end: i + keyword.length };
    }
  }
  return best;
}

type KindSignal =
  | { kind: "refund" }
  | { kind: null; question: DraftQuestion }
  | { kind: "transfer-candidate" }
  | { kind: "income"; fromKa?: false }
  | { kind: "expense"; ka: boolean }
  | { kind: "unknown" };

function readKindSignal(seg: Segment): KindSignal {
  const head = seg.norm.trimStart();
  const offset = seg.norm.length - head.length;
  const strip = (len: number) => seg.remove(offset, offset + len);

  const refund = seg.find(/ได้เงินคืน|คืนเงิน|(?<![a-z])refund(?![a-z])/g);
  if (refund) {
    seg.remove(refund.index!, refund.index! + refund[0].length);
    return { kind: "refund" };
  }
  const card = seg.find(/จ่ายยอดบัตร|ชำระบัตร|จ่ายบัตร/g);
  if (card) {
    seg.remove(card.index!, card.index! + card[0].length);
    return { kind: null, question: "card_payment_or_expense" };
  }
  let m = /^(โอนเข้า|เงินเข้า|ได้|รับ)/.exec(head);
  if (m) {
    strip(m[0].length);
    return { kind: "income" };
  }
  if (/^(เงินเดือน|ค่าจ้าง|โบนัส)/.test(head)) return { kind: "income" };
  if (head.startsWith("โอน")) {
    strip("โอน".length);
    return { kind: "transfer-candidate" };
  }
  m = /^(จ่าย|ซื้อ|ทดลอง)/.exec(head);
  if (m) {
    strip(m[0].length);
    return { kind: "expense", ka: false };
  }
  if (/^(ค่า|เติม)/.test(head)) return { kind: "expense", ka: head.startsWith("ค่า") };
  return { kind: "unknown" };
}

// ---------------------------------------------------------------------------

function parseItem(src: Source, ctx: ParseContext): Draft | null {
  const seg = new Segment(src);
  const accounts = ctx.accounts.filter((a) => !a.hidden);
  const uncertain = new Set<UncertainField>();

  // Protect digits inside category keywords such as "7-11" from amount detection.
  for (const { keyword } of CATEGORY_KEYWORD_LIST) {
    if (!/\d/.test(keyword)) continue;
    const i = indexOfWord(seg.norm, keyword);
    if (i >= 0) for (let j = i; j < i + keyword.length; j++) seg.protectedChars[j] = true;
  }

  const isTrial = seg.norm.includes("ทดลอง");
  const dateInfo = extractDate(seg);

  let explicitAccount: Account | undefined;
  const last4 = seg.find(EXPLICIT_LAST4_RE);
  if (last4) {
    explicitAccount = accounts.find((a) => a.last4 === last4[1]);
    seg.remove(last4.index!, last4.index! + last4[0].length);
  }

  const currency = extractCurrency(seg);
  const { amount, last4Account } = extractAmount(seg, accounts);
  if (!amount) return null;
  explicitAccount ??= last4Account;

  let cadence = extractCadence(seg);
  const signal = readKindSignal(seg);

  // Transfers need both of the user's accounts: "โอน … จาก A ไป B" or "โอน … A ไป B".
  let kind: Draft["kind"] = null;
  let question: DraftQuestion | undefined;
  let fromAccountId: string | undefined;
  let toAccountId: string | undefined;
  if (signal.kind === "transfer-candidate") {
    const pivot = indexOfWord(seg.norm, "ไป");
    const toHit = pivot >= 0 ? findAccount(seg, accounts, pivot) : undefined;
    const fromHit = pivot >= 0 ? findAccount(seg, accounts, 0, pivot) : undefined;
    if (fromHit && toHit && fromHit.account.id !== toHit.account.id) {
      kind = "transfer";
      fromAccountId = fromHit.account.id;
      toAccountId = toHit.account.id;
      removeAccountMention(seg, toHit);
      removeAccountMention(seg, fromHit);
    } else {
      question = "transfer_or_expense";
    }
  } else if (signal.kind === "unknown") {
    kind = "expense";
    uncertain.add("kind");
  } else if (signal.kind === null) {
    question = signal.question;
  } else {
    kind = signal.kind;
  }

  // Category (not for transfers or open questions), reconciled with the kind.
  let categoryId: string | undefined;
  if (kind !== null && kind !== "transfer") {
    const hit = findCategory(seg);
    const cat = hit ? categoryById(hit.categoryId) : undefined;
    const wantKind = kind === "income" ? "income" : "expense";
    if (cat && cat.kind !== wantKind) {
      const kindIsWeak = uncertain.has("kind") || (signal.kind === "expense" && signal.ka);
      if (kindIsWeak && cat.kind === "income") {
        kind = "income";
        uncertain.add("kind");
        categoryId = cat.id;
      }
    } else if (cat) {
      categoryId = cat.id;
    }
    if (!categoryId) {
      categoryId = kind === "income" ? "other_in" : "other_out";
      uncertain.add("category");
    }
  }

  // Account for everything except transfers.
  let accountId: string | undefined;
  if (kind !== "transfer") {
    const hit = findAccount(seg, accounts);
    if (explicitAccount) accountId = explicitAccount.id;
    else if (hit) accountId = hit.account.id;
    if (hit) removeAccountMention(seg, hit);
    if (!accountId) {
      accountId = accounts.find((a) => a.type === "cash")?.id;
      uncertain.add("account");
    }
  }

  // Trial: "ทดลอง … ถึง <date>" → monthly unless stated; the trial end is the first charge.
  let trialEndsOn: LocalDate | undefined;
  if (isTrial && dateInfo.explicit && cadence === "once") cadence = "month";
  const { date, dayOfMonth } = resolveDate(dateInfo, ctx.today, cadence !== "once" || isTrial);
  if (isTrial && dateInfo.explicit) trialEndsOn = date;

  const amountMinor = amount.minor;
  if (amountMinor === null || amountMinor <= 0) uncertain.add("amount");

  let name = seg
    .leftover()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(เข้า|ไป|จาก)\s+|\s+(เข้า|ไป|จาก)$/g, "")
    .replace(/(เข้า|ถึง)$/, "")
    .replace(/^[\s\-–—:·.]+|[\s\-–—:·.]+$/g, "")
    .trim();
  if (!name) {
    if (question === "card_payment_or_expense") name = "จ่ายบัตร";
    else if (signal.kind === "transfer-candidate") name = "โอน";
    else {
      name = categoryName(categoryId);
      uncertain.add("name");
    }
  }

  return {
    kind,
    name,
    amountMinor,
    currency,
    date,
    cadence,
    ...(dayOfMonth !== undefined ? { dayOfMonth } : {}),
    ...(trialEndsOn ? { trialEndsOn } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(accountId ? { accountId } : {}),
    ...(fromAccountId ? { fromAccountId, toAccountId } : {}),
    scope: "personal",
    uncertain: [...uncertain],
    ...(question ? { question } : {}),
  };
}

/** Parse a sentence into drafts. `[]` means no amount was found → show `ใส่ยอดเป็นตัวเลข เช่น จ่ายกาแฟ 65`. */
export function parseSentence(text: string, ctx: ParseContext): Draft[] {
  return splitItems(normalize(text))
    .map((item) => parseItem(item, ctx))
    .filter((d): d is Draft => d !== null);
}

/** Why a draft cannot be saved yet (Thai UI text); empty = ready. */
export function draftIssues(draft: Draft): string[] {
  const issues: string[] = [];
  if (draft.kind === null) issues.push("ตอบคำถามก่อนบันทึก");
  if (!draft.name.trim()) issues.push("ใส่ชื่อรายการ");
  if (draft.amountMinor === null || draft.amountMinor <= 0) issues.push("ยอดต้องมากกว่า 0");
  if (draft.kind === "transfer" && (!draft.fromAccountId || !draft.toAccountId || draft.fromAccountId === draft.toAccountId)) {
    issues.push("เลือกบัญชีต้นทางและปลายทาง");
  }
  return issues;
}
