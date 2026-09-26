// Word lists for the rule-based parser — docs/03-parser-spec.md §3.

import type { Account } from "../types";

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  software: ["claude", "chatgpt", "openai", "notion", "github", "copilot", "figma", "canva", "adobe", "perplexity", "cursor", "midjourney"],
  entertainment: ["netflix", "youtube", "disney", "hbo", "viu", "wetv", "trueid", "major", "หนัง", "เกม", "คอนเสิร์ต"],
  music: ["spotify", "apple music", "joox"],
  cloud: ["icloud", "google one", "dropbox", "onedrive"],
  health: ["fitness", "ฟิตเนส", "ยา", "หมอ", "คลินิก", "โรงพยาบาล", "gym"],
  food: ["กาแฟ", "ข้าว", "อาหาร", "ก๋วยเตี๋ยว", "ชา", "ส้มตำ", "grab food", "lineman", "7-11", "เซเว่น", "ขนม", "หมูกระทะ"],
  transport: ["bts", "mrt", "แท็กซี่", "taxi", "grab", "bolt", "วิน", "น้ำมัน", "ทางด่วน"],
  home: ["ค่าเช่า", "ค่าห้อง", "ค่าไฟ", "ค่าน้ำ", "ค่าเน็ต", "ais", "true", "dtac"],
  salary: ["เงินเดือน"],
  side: ["ค่างาน", "งานเสริม", "ฟรีแลนซ์", "ค่าจ้าง", "พาร์ตไทม์", "mercor"],
};

/** Keywords sorted longest first so `grab food` wins over `grab`. */
export const CATEGORY_KEYWORD_LIST: { keyword: string; categoryId: string }[] = Object.entries(CATEGORY_KEYWORDS)
  .flatMap(([categoryId, words]) => words.map((keyword) => ({ keyword, categoryId })))
  .sort((a, b) => b.keyword.length - a.keyword.length);

/** Aliases for a known bank/wallet, applied when the user's account name matches `names`. */
const PROVIDERS: { names: string[]; aliases: string[] }[] = [
  { names: ["kbank", "กสิกร", "kasikorn"], aliases: ["กสิกร", "kbank", "k plus", "kplus"] },
  { names: ["scb", "ไทยพาณิชย์"], aliases: ["scb", "ไทยพาณิชย์", "scb easy"] },
  { names: ["krungthai", "กรุงไทย", "ktb"], aliases: ["กรุงไทย", "ktb", "เป๋าตัง"] },
  { names: ["bangkok bank", "กรุงเทพ", "bbl"], aliases: ["กรุงเทพ", "bbl"] },
  { names: ["ktc"], aliases: ["ktc", "บัตร ktc"] },
  { names: ["truemoney", "ทรูมันนี่"], aliases: ["truemoney", "ทรูมันนี่", "tmn", "วอลเล็ต"] },
];

/** Every alias that should resolve to this account (lower-case). */
export function accountAliases(account: Account): string[] {
  const name = account.name.toLowerCase();
  const aliases = new Set<string>([name]);
  for (const p of PROVIDERS) {
    if (p.names.some((n) => name.includes(n))) p.aliases.forEach((a) => aliases.add(a));
  }
  if (account.type === "cash") ["เงินสด", "cash"].forEach((a) => aliases.add(a));
  if (account.type === "promptpay") ["พร้อมเพย์", "promptpay"].forEach((a) => aliases.add(a));
  return [...aliases];
}
