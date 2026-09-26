import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { openApp, saveDraft, statValue, typeSentence } from "./helpers";

const TODAY = "2026-10-10";
const nav = (page: Page) => page.getByRole("navigation", { name: "เมนูหลัก" }).filter({ visible: true });
const go = async (page: Page, tab: string, heading: RegExp) => {
  await nav(page).getByRole("link", { name: tab }).click();
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
};
const cell = (page: Page, date: string) => page.locator(`[data-date="${date}"]`);

test.describe("P6 — ปฏิทิน", () => {
  test("A-16 actual and expected are separated in the grid and in the day list", async ({ page }) => {
    await openApp(page, TODAY);
    await go(page, "ปฏิทิน", /ปฏิทิน ต.ค. 2026/);
    await expect(cell(page, "2026-10-04")).toHaveAttribute("aria-label", /เกิดขึ้นแล้ว/);
    await expect(cell(page, "2026-10-13")).toHaveAttribute("aria-label", /คาดว่าจะเกิด 1 รายการ/);
    await cell(page, "2026-10-13").click();
    const detail = page.getByTestId("day-detail");
    await expect(page.getByTestId("day-expected")).toContainText("YouTube Premium");
    await expect(detail).toContainText("ไม่มีรายการที่เกิดขึ้นแล้ว");
    await cell(page, "2026-10-04").click();
    await expect(detail.getByRole("button", { name: /Netflix/ })).toBeVisible();
    await expect(page.getByTestId("calendar-summary")).toContainText("บิลซ้ำที่ตัด");
  });

  test("A-17 at 390px: no overlapping text, no page scroll", async ({ page }, info) => {
    await openApp(page, TODAY);
    await go(page, "ปฏิทิน", /ปฏิทิน/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    // Every cell's content stays inside its own column.
    const spill = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-date]")].filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.dataset.date),
    );
    expect(spill).toEqual([]);
    if (info.project.name === "mobile-390") {
      await expect(cell(page, "2026-10-13").locator("span.truncate").first()).toBeHidden();
    } else {
      await expect(cell(page, "2026-10-13")).toContainText("−YouTube Premium");
    }
  });

  test("A-4 (calendar) a new monthly bill appears on its day", async ({ page }) => {
    await openApp(page, TODAY);
    await typeSentence(page, "จ่าย Disney+ 289 ทุกเดือนวันที่ 5 บัตรกสิกร");
    await saveDraft(page);
    await go(page, "ปฏิทิน", /ปฏิทิน/);
    await page.getByRole("button", { name: "เดือนถัดไป" }).click();
    await cell(page, "2026-11-05").click();
    await expect(page.getByTestId("day-expected")).toContainText("Disney+");
  });
});

test.describe("P6 — เป้าและตั้งค่า", () => {
  test("A-18 goal and FX update expected ≈ baht but not saved rows", async ({ page }) => {
    await openApp(page, TODAY);
    await go(page, "เป้า", /เป้าและตั้งค่า/);
    await page.getByLabel("เป้า (บาท)").fill("5000");
    await page.getByLabel("เป้า (บาท)").press("Enter");
    await page.getByLabel("USD → บาท").fill("34");
    await page.getByLabel("USD → บาท").press("Enter");
    await go(page, "ภาพรวม", /รอบ/);
    await expect(page.getByTestId("side-income")).toContainText("90%");
    await expect(page.getByTestId("side-income")).toContainText("ขาดอีก ฿500");
    await expect(page.getByTestId("upcoming").locator("li", { hasText: "ChatGPT Plus" })).toContainText("≈ ฿680");
    await go(page, "เงินเข้า-ออก", /รอบ/);
    await expect(page.getByTestId("tx-list").getByRole("button", { name: /Claude Pro/ })).toContainText("≈ ฿665");
  });

  test("A-19 cycle starting on the 25th changes the label and the numbers", async ({ page }) => {
    await openApp(page, TODAY);
    await go(page, "เป้า", /เป้าและตั้งค่า/);
    await page.getByLabel("เริ่มรอบทุกวันที่").selectOption("25");
    await go(page, "ภาพรวม", /รอบ/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("รอบ 25 ก.ย. – 24 ต.ค.");
    const income = await statValue(page, "stat-income");
    expect(income).toBe(49_500);
    await page.getByRole("button", { name: "รอบก่อนหน้า" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("รอบ 25 ส.ค. – 24 ก.ย.");
    expect(await statValue(page, "stat-income")).toBe(0);
  });

  test("A-20 no bank connection, last 4 digits only, no CVV/expiry", async ({ page }) => {
    await openApp(page, TODAY);
    await go(page, "เป้า", /เป้าและตั้งค่า/);
    await expect(page.getByRole("button", { name: /เชื่อม/ })).toHaveCount(0);
    await page.getByRole("button", { name: "+ บัญชี" }).click();
    const dialog = page.getByRole("dialog", { name: "เพิ่มบัญชี" });
    await dialog.getByLabel("ชื่อบัญชี").fill("Krungsri Card");
    const last4 = dialog.getByLabel(/4 ตัวท้าย/);
    await last4.fill("4111111111111111");
    await expect(last4).toHaveValue("4111");
    await expect(dialog.getByLabel(/CVV|หมดอายุ|เลขบัตรเต็ม/)).toHaveCount(0);
    await dialog.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByRole("region", { name: "บัญชี" })).toContainText("Krungsri Card ••4111");
  });

  test("A-21 CSV is UTF-8 with BOM and a Thai header", async ({ page }) => {
    await openApp(page, TODAY);
    await go(page, "เป้า", /เป้าและตั้งค่า/);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "ส่งออก CSV" }).click()]);
    expect(download.suggestedFilename()).toBe(`henngern-${TODAY}.csv`);
    const bytes = readFileSync((await download.path())!);
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = bytes.toString("utf8");
    expect(text).toContain("วันที่,ชนิด,ชื่อ,ยอด");
    expect(text).toContain("ค่าเช่าห้อง");
  });

  test("A-D4 export JSON, change data, import the file back → numbers restored", async ({ page }) => {
    await openApp(page, TODAY);
    const income = await statValue(page, "stat-income");
    await go(page, "เป้า", /เป้าและตั้งค่า/);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "ส่งออก JSON" }).click()]);
    const file = (await download.path())!;
    await typeSentence(page, "ได้ค่างาน 1000");
    await saveDraft(page);
    await page.getByLabel("นำเข้า JSON").setInputFiles(file);
    await page.getByRole("group", { name: /นำเข้าไฟล์นี้จะแทนที่ข้อมูลทั้งหมด/ }).getByRole("button", { name: "นำเข้า" }).click();
    await go(page, "ภาพรวม", /รอบ/);
    expect(await statValue(page, "stat-income")).toBe(income);
  });

  test("a bad import file is rejected and nothing changes", async ({ page }) => {
    await openApp(page, TODAY);
    await go(page, "เป้า", /เป้าและตั้งค่า/);
    await page.getByLabel("นำเข้า JSON").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("{nope") });
    await expect(page.getByRole("alert").filter({ hasText: "อ่านไม่ได้" })).toBeVisible();
    await go(page, "ภาพรวม", /รอบ/);
    expect(await statValue(page, "stat-income")).toBe(49_500);
  });

  test("clear local data asks first, then empties the book; load sample restores it", async ({ page }) => {
    await openApp(page, TODAY);
    await go(page, "เป้า", /เป้าและตั้งค่า/);
    await page.getByRole("button", { name: "ล้างข้อมูลในเครื่อง" }).click();
    await page.getByRole("button", { name: "ล้างข้อมูล", exact: true }).click();
    await go(page, "ภาพรวม", /รอบ/);
    expect(await statValue(page, "stat-income")).toBe(0);
    await go(page, "เป้า", /เป้าและตั้งค่า/);
    await page.getByRole("button", { name: "โหลดข้อมูลตัวอย่าง" }).click();
    await page.getByRole("button", { name: "โหลดตัวอย่าง", exact: true }).click();
    await go(page, "ภาพรวม", /รอบ/);
    await expect(page.getByTestId("sample-banner")).toBeVisible();
  });
});
