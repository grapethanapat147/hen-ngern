// Default categories — docs/02-domain-rules.md §3. Ids are stable; names are Thai UI text.

export interface Category {
  id: string;
  kind: "income" | "expense";
  name: string;
}

export const CATEGORIES: readonly Category[] = [
  { id: "salary", kind: "income", name: "เงินเดือน" },
  { id: "side", kind: "income", name: "งานเสริม" },
  { id: "family_in", kind: "income", name: "ครอบครัว" },
  { id: "other_in", kind: "income", name: "อื่น ๆ" },
  { id: "software", kind: "expense", name: "งาน/ซอฟต์แวร์" },
  { id: "entertainment", kind: "expense", name: "บันเทิง" },
  { id: "health", kind: "expense", name: "สุขภาพ" },
  { id: "food", kind: "expense", name: "อาหาร" },
  { id: "transport", kind: "expense", name: "เดินทาง" },
  { id: "home", kind: "expense", name: "บ้าน" },
  { id: "cloud", kind: "expense", name: "คลาวด์" },
  { id: "music", kind: "expense", name: "เพลง" },
  { id: "other_out", kind: "expense", name: "อื่น ๆ" },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export const categoryById = (id: string | undefined): Category | undefined => (id ? BY_ID.get(id) : undefined);
export const categoryName = (id: string | undefined): string => categoryById(id)?.name ?? "อื่น ๆ";

export const SIDE_INCOME_CATEGORY = "side";
