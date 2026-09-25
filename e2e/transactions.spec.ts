import { expect, test, type Page } from "@playwright/test";
import { openApp, saveDraft } from "./helpers";

const TODAY = "2026-10-10";

async function gotoList(page: Page) {
  await openApp(page, TODAY);
  const nav = page.getByRole("navigation", { name: "เมนูหลัก" }).filter({ visible: true });
  await nav.getByRole("link", { name: "เงินเข้า-ออก" }).click();
  await expect(page.getByTestId("tx-list")).toBeVisible();
}

const baht = (text: string) => Number(text.replace(/[^\d.]/g, ""));

async function headerTotal(page: Page) {
  const text = await page.getByTestId("list-total").locator("[aria-label]").last().innerText();
  return (text.includes("−") ? -1 : 1) * baht(text);
}

/** Signed THB of visible rows, transfers excluded: income/refund +, expense −. */
async function visibleSigned(page: Page) {
  const amounts = page.getByTestId("tx-amount");
  let sum = 0;
  for (let i = 0; i < (await amounts.count()); i++) {
    const kind = await amounts.nth(i).getAttribute("data-kind");
    const value = baht(await amounts.nth(i).innerText());
    if (kind === "expense") sum -= value;
    if (kind === "income" || kind === "refund") sum += value;
  }
  return Math.round(sum * 100) / 100;
}

const row = (page: Page, name: string) => page.getByTestId("tx-list").getByRole("button", { name: new RegExp(name) });
const chip = (page: Page, name: string) => page.getByRole("group", { name: "ตัวกรอง" }).getByRole("button", { name, exact: true });

test.describe("P4 — เงินเข้า-ออก", () => {
  test("A-7 search + chips combine and the header total matches the visible rows", async ({ page }) => {
    await gotoList(page);
    expect(await headerTotal(page)).toBeCloseTo(await visibleSigned(page), 2);

    await chip(page, "รายจ่าย").click();
    await expect(chip(page, "รายจ่าย")).toHaveAttribute("aria-pressed", "true");
    expect(await headerTotal(page)).toBeCloseTo(-(await visibleSigned(page)), 2);

    await page.getByRole("searchbox", { name: "ค้นหาชื่อ" }).fill("grab");
    await expect(page.getByTestId("tx-amount")).toHaveCount(2); // Grab Food + its refund
    expect(await headerTotal(page)).toBeCloseTo(189 - 50, 2);

    await chip(page, "รายรับ").click();
    await expect(page.getByText("ไม่พบรายการที่ตรงกับตัวกรอง")).toBeVisible();
    expect(await headerTotal(page)).toBe(0);
  });

  test("transfers are listed but never in the net", async ({ page }) => {
    await gotoList(page);
    await chip(page, "โอน").click();
    await expect(page.getByTestId("tx-amount")).toHaveCount(1);
    await expect(page.getByTestId("list-total")).toContainText("ไม่นับเป็นรายรับรายจ่าย");
  });

  test("A-8 a USD row shows US$20 and ≈ ฿665", async ({ page }) => {
    await gotoList(page);
    const claude = row(page, "Claude Pro");
    await expect(claude).toContainText("US$20");
    await expect(claude).toContainText("≈ ฿665");
  });

  test("A-9 delete lowers the total; undo restores it", async ({ page }) => {
    await gotoList(page);
    await chip(page, "รายจ่าย").click();
    const before = await headerTotal(page);
    await row(page, "แท็กซี่").click();
    const dialog = page.getByRole("dialog", { name: "แก้ไขรายการ" });
    await dialog.getByRole("button", { name: "ลบ", exact: true }).click();
    await dialog.getByRole("group", { name: "ยืนยันลบ" }).getByRole("button", { name: "ลบ", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("ลบแล้ว");
    expect(await headerTotal(page)).toBeCloseTo(before - 220, 2);
    await expect(row(page, "แท็กซี่")).toHaveCount(0);
    await page.getByRole("status").getByRole("button", { name: "เลิกทำ" }).click();
    expect(await headerTotal(page)).toBeCloseTo(before, 2);
    await expect(row(page, "แท็กซี่")).toHaveCount(1);
  });

  test("A-10 a refund linked to an expense lowers spending and both rows stay", async ({ page }) => {
    await gotoList(page);
    await chip(page, "รายจ่าย").click();
    const before = await headerTotal(page);
    await page.getByRole("button", { name: "+ รายการ" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: "คืนเงิน" }).check();
    await dialog.getByLabel("ชื่อ").fill("คืนค่าแท็กซี่");
    await dialog.getByLabel("ยอด", { exact: true }).fill("20");
    const picker = dialog.getByLabel("คืนเงินของรายการ");
    const value = await picker.locator("option", { hasText: "แท็กซี่" }).getAttribute("value");
    await picker.selectOption(value!);
    await saveDraft(page);
    expect(await headerTotal(page)).toBeCloseTo(before - 20, 2);
    await page.getByRole("searchbox", { name: "ค้นหาชื่อ" }).fill("แท็กซี่");
    await expect(page.getByTestId("tx-amount")).toHaveCount(2);
    await expect(row(page, "คืนค่าแท็กซี่")).toContainText("คืนเงิน · เดินทาง");
  });

  test("edit a row, then undo the edit", async ({ page }) => {
    await gotoList(page);
    await row(page, "^กาแฟ").click();
    const dialog = page.getByRole("dialog", { name: "แก้ไขรายการ" });
    await expect(dialog.getByLabel("รูปแบบ")).toHaveCount(0);
    await dialog.getByLabel("ยอด", { exact: true }).fill("80");
    await saveDraft(page);
    await expect(row(page, "^กาแฟ")).toContainText("฿80");
    await page.getByRole("status").getByRole("button", { name: "เลิกทำ" }).click();
    await expect(row(page, "^กาแฟ")).toContainText("฿65");
  });

  test("paid bills show the ซ้ำ badge and the difference from expected", async ({ page }) => {
    await gotoList(page);
    const spotify = row(page, "Spotify");
    await expect(spotify).toContainText("ซ้ำ");
    await expect(spotify).toContainText("ต่างจากที่คาด +฿10");
  });

  test("A-23 an insight opens exactly its source rows", async ({ page }) => {
    await openApp(page, TODAY);
    await page.getByRole("link", { name: /จ่ายหมวดบ้านมากสุด/ }).click();
    await expect(page.getByRole("heading", { name: /รายการที่มาของความเห็น \(1\)/ })).toBeVisible();
    await expect(row(page, "ค่าเช่าห้อง")).toBeVisible();
  });

  test("A-24 (partial) keyboard: open a row with Enter, Esc returns focus to it", async ({ page }) => {
    await gotoList(page);
    const target = row(page, "Claude Pro");
    await target.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "แก้ไขรายการ" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(target).toBeFocused();
  });
});
