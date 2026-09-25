import { expect, test, type Page } from "@playwright/test";
import { openApp, saveDraft, statValue, typeSentence } from "./helpers";

const TODAY = "2026-10-10";

const nav = (page: Page) => page.getByRole("navigation", { name: "เมนูหลัก" }).filter({ visible: true });
const item = (page: Page, name: string) => page.locator(`[data-rule="${name}"]`).filter({ visible: true });

async function gotoRecurring(page: Page) {
  await openApp(page, TODAY);
  await nav(page).getByRole("link", { name: "รายการซ้ำ" }).click();
  await expect(page.getByRole("heading", { name: "รายการซ้ำ", level: 1 })).toBeVisible();
}

async function gotoOverview(page: Page) {
  await nav(page).getByRole("link", { name: "ภาพรวม" }).click();
  await expect(page.getByTestId("stat-income")).toBeVisible();
}

async function openRule(page: Page, name: string) {
  await item(page, name).getByRole("button", { name: `${name} แก้ไข` }).click();
  await expect(page.getByRole("dialog", { name: "แก้ไขรายการซ้ำ" })).toBeVisible();
  return page.getByRole("dialog", { name: "แก้ไขรายการซ้ำ" });
}

async function saveRule(page: Page) {
  await page.getByRole("dialog").getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

test.describe("P5 — รายการซ้ำ", () => {
  test("summary splits money out and in, all as expected", async ({ page }) => {
    await gotoRecurring(page);
    const summary = page.getByTestId("recurring-summary");
    await expect(summary).toContainText("ใช้อยู่");
    await expect(summary).toContainText("11 รายการ");
    await expect(summary).toContainText("฿8,000"); // part-time income per month
    await expect(summary.getByText("คาดว่าจะเกิด")).toHaveCount(2);
  });

  test("A-11 จ่ายแล้ว: actual up, expected down, counted once; next date moves on", async ({ page }) => {
    await openApp(page, TODAY);
    const expense = await statValue(page, "stat-expense");
    const expected = await statValue(page, "stat-expected");
    await nav(page).getByRole("link", { name: "รายการซ้ำ" }).click();
    const yt = item(page, "YouTube Premium");
    await expect(yt).toContainText("13 ต.ค.");
    await yt.getByRole("button", { name: /จ่ายแล้ว 13 ต.ค./ }).click();
    await saveDraft(page);
    await expect(yt).toContainText("13 พ.ย.");
    await expect(yt).toContainText("จ่ายจริงรอบนี้ ฿179");
    await gotoOverview(page);
    expect(await statValue(page, "stat-expense")).toBeCloseTo(expense + 179, 2);
    expect(await statValue(page, "stat-expected")).toBeCloseTo(expected - 179, 2);
  });

  test("A-12 paying a different amount shows the difference", async ({ page }) => {
    await gotoRecurring(page);
    await expect(item(page, "Spotify")).toContainText("ต่างจากที่คาด +฿10");
    await item(page, "YouTube Premium").getByRole("button", { name: /จ่ายแล้ว/ }).click();
    await page.getByRole("dialog").getByLabel("ยอด", { exact: true }).fill("199");
    await saveDraft(page);
    await expect(item(page, "YouTube Premium")).toContainText("ต่างจากที่คาด +฿20");
  });

  test("A-14 trial: badge, countdown, and no expected charge before it ends", async ({ page }) => {
    await gotoRecurring(page);
    await expect(item(page, "Perplexity Pro")).toContainText("ทดลองถึง 17 ต.ค.");
    await gotoOverview(page);
    const trial = page.getByRole("region", { name: "ช่วงทดลองใช้ฟรี" });
    await expect(trial).toContainText("เหลือ 7 วัน");
    await expect(trial).toContainText("≈ ฿665");
    await expect(trial).toContainText("ยกเลิกก่อนหมด = ไม่โดนหัก");
    const expected = await statValue(page, "stat-expected");
    await typeSentence(page, "ทดลอง Canva 15 ดอลลาร์ ถึง 5 พ.ย.");
    await saveDraft(page);
    await expect(trial).toContainText("Canva");
    expect(await statValue(page, "stat-expected")).toBeCloseTo(expected, 2);
  });

  test("A-15 a rule that has ended has no more occurrences", async ({ page }) => {
    await gotoRecurring(page);
    const dialog = await openRule(page, "YouTube Premium");
    await dialog.getByLabel("วันสิ้นสุด").fill("2026-10-12");
    await saveRule(page);
    await expect(item(page, "YouTube Premium")).toHaveCount(0);
    await page.locator("summary", { hasText: "เลิกใช้แล้ว" }).click();
    await expect(page.locator('[data-ended-rule="YouTube Premium"]')).toBeVisible();
    await gotoOverview(page);
    await expect(page.getByTestId("upcoming")).not.toContainText("YouTube Premium");
  });

  test("edit price from the next time on: saved payment stays, next uses the new price; undo", async ({ page }) => {
    await gotoRecurring(page);
    const dialog = await openRule(page, "Netflix");
    await expect(dialog.getByRole("radio", { name: /ใช้กับครั้งต่อไป/ })).toBeChecked();
    await dialog.getByLabel("ยอดต่อครั้ง").fill("459");
    await saveRule(page);
    await expect(page.getByRole("status")).toContainText("มีผลตั้งแต่ครั้งต่อไป");
    await expect(item(page, "Netflix")).toHaveCount(1);
    await expect(item(page, "Netflix")).toContainText("฿459");
    await expect(item(page, "Netflix")).toContainText("4 พ.ย.");
    await page.getByRole("status").getByRole("button", { name: "เลิกทำ" }).click();
    await expect(item(page, "Netflix")).toContainText("฿419");
    await nav(page).getByRole("link", { name: "เงินเข้า-ออก" }).click();
    await expect(page.getByTestId("tx-list").getByRole("button", { name: /Netflix/ })).toContainText("฿419");
  });

  test("ข้ามรอบนี้ removes that charge from expected; undo brings it back", async ({ page }) => {
    await openApp(page, TODAY);
    const expected = await statValue(page, "stat-expected");
    await nav(page).getByRole("link", { name: "รายการซ้ำ" }).click();
    await item(page, "ChatGPT Plus").getByRole("button", { name: /ข้ามรอบนี้/ }).click();
    await expect(item(page, "ChatGPT Plus")).toContainText("15 พ.ย.");
    await gotoOverview(page);
    expect(await statValue(page, "stat-expected")).toBeCloseTo(expected - 665, 2);
    await nav(page).getByRole("link", { name: "รายการซ้ำ" }).click();
    await item(page, "YouTube Premium").getByRole("button", { name: /ข้ามรอบนี้/ }).click();
    await page.getByRole("status").getByRole("button", { name: "เลิกทำ" }).click();
    await expect(item(page, "YouTube Premium")).toContainText("13 ต.ค.");
  });

  test("เลิกใช้ then ใช้ต่อ", async ({ page }) => {
    await gotoRecurring(page);
    const dialog = await openRule(page, "ฟิตเนส");
    await dialog.getByRole("button", { name: /เลิกใช้/ }).click();
    await expect(item(page, "ฟิตเนส")).toHaveCount(0);
    await page.locator("summary", { hasText: "เลิกใช้แล้ว" }).click();
    await page.getByRole("button", { name: "เปิด ฟิตเนส" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ใช้ต่อ" }).click();
    await expect(item(page, "ฟิตเนส")).toHaveCount(1);
  });

  test("delete is only offered when no real payment is linked", async ({ page }) => {
    await gotoRecurring(page);
    let dialog = await openRule(page, "Netflix");
    await expect(dialog.getByRole("button", { name: "ลบ", exact: true })).toHaveCount(0);
    await expect(dialog).toContainText("ใช้ “เลิกใช้” แทนการลบ");
    await page.keyboard.press("Escape");
    dialog = await openRule(page, "Notion");
    await dialog.getByRole("button", { name: "ลบ", exact: true }).click();
    await dialog.getByRole("group", { name: "ยืนยันลบ" }).getByRole("button", { name: "ลบ", exact: true }).click();
    await expect(item(page, "Notion")).toHaveCount(0);
    await page.getByRole("status").getByRole("button", { name: "เลิกทำ" }).click();
    await expect(item(page, "Notion")).toHaveCount(1);
  });

  test("+ บิลซ้ำ adds a monthly rule", async ({ page }) => {
    await gotoRecurring(page);
    await page.getByRole("button", { name: "+ บิลซ้ำ" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("รูปแบบ")).toHaveValue("month");
    await dialog.getByLabel("ชื่อ").fill("ค่าเน็ตบ้าน");
    await dialog.getByLabel("ยอด", { exact: true }).fill("599");
    await dialog.getByLabel("ครั้งแรก").fill("2026-10-20");
    await saveDraft(page);
    await expect(item(page, "ค่าเน็ตบ้าน")).toContainText("ทุกเดือน วันที่ 20");
    await expect(page.getByTestId("recurring-summary")).toContainText("12 รายการ");
  });
});
