import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { openApp, saveDraft, typeSentence } from "./helpers";

const nav = (page: Page) => page.getByRole("navigation", { name: "เมนูหลัก" }).filter({ visible: true });

test("ส่งออกสำหรับงานวิจัย: no names or amounts, but records what the user had to fix", async ({ page }) => {
  await openApp(page, "2026-10-10");
  await page.getByRole("button", { name: "เริ่มสมุดของฉัน" }).click();
  await page.getByRole("button", { name: "ยืนยัน" }).click();
  await expect(page).toHaveURL(/\/settings$/);

  // Parser guesses transport + cash; the user fixes the category.
  await typeSentence(page, "แท็กซี่ไปหาหมอสมศรี 220");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^หมวด/).selectOption("health");
  await saveDraft(page);
  // Saved exactly as parsed.
  await typeSentence(page, "กาแฟ 65 เงินสด");
  await saveDraft(page);

  await page.getByRole("button", { name: "ส่งออกสำหรับงานวิจัย" }).click();
  const panel = page.getByTestId("research-panel");
  await expect(panel).toContainText("ไม่มี: ชื่อรายการ · หมายเหตุ · ยอดเงิน");
  await expect(panel).toContainText("รายการที่คุณจดเอง 2 รายการ · จด 1 วัน");
  const [download] = await Promise.all([page.waitForEvent("download"), panel.getByRole("button", { name: "ดาวน์โหลดไฟล์วิจัย" }).click()]);
  expect(download.suggestedFilename()).toBe("henngern-research-2026-10-10.json");

  const text = readFileSync((await download.path())!, "utf8");
  for (const secret of ["แท็กซี่", "สมศรี", "กาแฟ", "220", "22000", "6500", "เงินสด", "amountMinor"]) expect(text, secret).not.toContain(secret);
  const data = JSON.parse(text);
  expect(data.format).toBe("henngern-research-v1");
  expect(data.summary).toMatchObject({ confirmedCount: 2, fromSentenceCount: 2, sentenceUncorrectedCount: 1, correctionsByField: { category: 1 } });
  expect(data.transactions.map((t: { correctedFields: string[] }) => t.correctedFields)).toEqual([["category"], []]);
});

test("the research panel says when the book is still sample data", async ({ page }) => {
  await openApp(page, "2026-10-10");
  await nav(page).getByRole("link", { name: "เป้า" }).click();
  await page.getByRole("button", { name: "ส่งออกสำหรับงานวิจัย" }).click();
  await expect(page.getByTestId("research-panel")).toContainText("ตอนนี้เป็นข้อมูลตัวอย่าง");
  await expect(page.getByTestId("research-panel")).toContainText("รายการที่คุณจดเอง 0 รายการ");
});
