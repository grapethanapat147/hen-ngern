import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

for (const path of ["/", "/transactions", "/recurring", "/calendar", "/settings"]) {
  test(`no horizontal page scroll on ${path}`, async ({ page }) => {
    await openApp(page);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
}

test("navigation marks the current tab", async ({ page }) => {
  await openApp(page);
  const nav = page.getByRole("navigation", { name: "เมนูหลัก" }).filter({ visible: true });
  await nav.getByRole("link", { name: "รายการซ้ำ" }).click();
  await expect(page).toHaveURL(/\/recurring$/);
  await expect(nav.getByRole("link", { name: "รายการซ้ำ" })).toHaveAttribute("aria-current", "page");
});
