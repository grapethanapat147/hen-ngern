import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { openApp, typeSentence } from "./helpers";

const serious = (violations: { impact?: string | null }[]) =>
  violations.filter((v) => v.impact === "serious" || v.impact === "critical");

test("A-25 (partial) ภาพรวม has no serious/critical axe violations", async ({ page }) => {
  await openApp(page, "2026-10-10");
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(serious(violations), JSON.stringify(serious(violations), null, 2)).toEqual([]);
});

test("draft sheet has no serious/critical axe violations", async ({ page }) => {
  await openApp(page);
  await typeSentence(page, "จ่ายบัตร 8,000");
  const { violations } = await new AxeBuilder({ page }).include("dialog").analyze();
  expect(serious(violations), JSON.stringify(serious(violations), null, 2)).toEqual([]);
});
