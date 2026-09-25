import { expect, type Page } from "@playwright/test";

export const TODAY = "2026-10-01";
export const SENTENCE_LABEL = "พิมพ์เป็นประโยค แล้วตรวจร่างก่อนบันทึก";

/** Freeze the page clock so sample data and parser dates are deterministic. */
export async function openApp(page: Page, today = TODAY) {
  await page.clock.setFixedTime(new Date(`${today}T10:00:00`));
  await page.goto("/");
  await expect(page.getByTestId("stat-income")).toBeVisible();
}

/** Parse the baht figure shown in a stat tile, e.g. "฿49,500" → 49500. */
export async function statValue(page: Page, testId: string): Promise<number> {
  const text = (await page.getByTestId(testId).locator("p").nth(1).innerText()).trim();
  const n = Number(text.replace(/[^\d.−-]/g, "").replace("−", "-"));
  if (Number.isNaN(n)) throw new Error(`Not a number: ${text}`);
  return n;
}

export async function typeSentence(page: Page, text: string) {
  await page.getByLabel(SENTENCE_LABEL).fill(text);
  await page.getByLabel(SENTENCE_LABEL).press("Enter");
  await expect(page.getByRole("dialog", { name: "ตรวจข้อมูลก่อนบันทึก" })).toBeVisible();
}

export async function saveDraft(page: Page) {
  await page.getByRole("dialog").getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("status")).toContainText("บันทึกแล้ว");
}
