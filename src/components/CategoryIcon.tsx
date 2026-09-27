import { createElement } from "react";
import {
  AppWindow,
  ArrowLeftRight,
  Banknote,
  Car,
  CirclePlus,
  Clapperboard,
  Cloud,
  HeartPulse,
  House,
  Laptop,
  Music,
  Shapes,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { categoryById } from "@/domain/categories";
import type { TxKind } from "@/domain/types";

// Category icons (docs/07-next-tasks.md T8) — Lucide, ISC licence. Decorative: the category name is always shown as text.

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  salary: Banknote,
  side: Laptop,
  family_in: Users,
  other_in: CirclePlus,
  software: AppWindow,
  entertainment: Clapperboard,
  health: HeartPulse,
  food: UtensilsCrossed,
  transport: Car,
  home: House,
  cloud: Cloud,
  music: Music,
  other_out: Shapes,
};

export const TRANSFER_ICON: LucideIcon = ArrowLeftRight;

/** Icon for a row: transfers get ⇄; unknown categories fall back to the kind's "other". */
export function iconFor(kind: TxKind | "income" | "expense", categoryId?: string): LucideIcon {
  if (kind === "transfer") return TRANSFER_ICON;
  const known = categoryId && categoryById(categoryId) ? CATEGORY_ICONS[categoryId] : undefined;
  return known ?? (kind === "income" ? CATEGORY_ICONS.other_in : CATEGORY_ICONS.other_out);
}

const TONE: Record<TxKind, string> = {
  income: "bg-sage-soft text-sage",
  refund: "bg-sage-soft text-sage",
  expense: "bg-teal-soft text-teal",
  transfer: "bg-line text-muted",
};

export function CategoryIcon({ kind, categoryId, size = "md" }: { kind: TxKind; categoryId?: string; size?: "sm" | "md" }) {
  const Icon = iconFor(kind, categoryId);
  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const glyph = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full ${box} ${TONE[kind]}`}>
      {createElement(Icon, { "aria-hidden": true, focusable: "false", className: glyph, strokeWidth: 1.8 })}
    </span>
  );
}
