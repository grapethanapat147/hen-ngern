import { describe, expect, it } from "vitest";
import { CATEGORY_ICONS, iconFor, TRANSFER_ICON } from "@/components/CategoryIcon";
import { CATEGORIES } from "@/domain/categories";

describe("category icons (T8)", () => {
  it("every category has its own icon", () => {
    for (const c of CATEGORIES) expect(CATEGORY_ICONS[c.id], c.id).toBeDefined();
    const distinct = new Set(CATEGORIES.map((c) => CATEGORY_ICONS[c.id]));
    expect(distinct.size).toBe(CATEGORIES.length);
  });

  it("transfers and unknown categories fall back sensibly", () => {
    expect(iconFor("transfer", "food")).toBe(TRANSFER_ICON);
    expect(iconFor("expense", "nope")).toBe(CATEGORY_ICONS.other_out);
    expect(iconFor("income", undefined)).toBe(CATEGORY_ICONS.other_in);
    expect(iconFor("refund", "food")).toBe(CATEGORY_ICONS.food);
  });
});
