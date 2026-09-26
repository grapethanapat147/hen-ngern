import { expect, test, type Page } from "@playwright/test";
import { openApp, SENTENCE_LABEL, statValue } from "./helpers";

const PAGES = [
  ["/", /รอบ/],
  ["/transactions", /รอบ/],
  ["/recurring", /รายการซ้ำ/],
  ["/calendar", /ปฏิทิน/],
  ["/settings", /เป้าและตั้งค่า/],
] as const;

async function visitAll(page: Page, each: (path: string) => Promise<void>) {
  for (const [path, heading] of PAGES) {
    if (path !== "/") await page.getByRole("navigation", { name: "เมนูหลัก" }).filter({ visible: true }).locator(`a[href="${path}"]`).click();
    else await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await each(path);
  }
}

test("A-26 no request leaves this origin (no AI, analytics or remote fonts)", async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const foreign: string[] = [];
  page.on("request", (r) => {
    const url = r.url();
    if (!url.startsWith(origin) && !url.startsWith("data:") && !url.startsWith("blob:")) foreign.push(url);
  });
  const csp: string[] = [];
  page.on("console", (m) => m.text().includes("Content Security Policy") && csp.push(m.text()));
  await openApp(page, "2026-10-10");
  await visitAll(page, async () => {});
  // Exercise the capture flow too.
  await page.getByLabel(SENTENCE_LABEL).fill("กาแฟ 65");
  await page.getByLabel(SENTENCE_LABEL).press("Enter");
  await page.getByRole("dialog").getByRole("button", { name: "บันทึก", exact: true }).click();
  expect(foreign).toEqual([]);
  expect(csp).toEqual([]);
});

test("A-26 the server sends a same-origin-only content security policy", async ({ request }) => {
  const res = await request.get("/");
  const policy = res.headers()["content-security-policy"];
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("connect-src 'self'");
  expect(policy).not.toContain("unsafe-eval");
});

const LOCKED = {
  tabs: ["ภาพรวม", "เงินเข้า-ออก", "รายการซ้ำ", "ปฏิทิน", "เป้า"],
  numbers: ["รับจริง", "จ่ายจริง", "สุทธิรอบนี้", "จะตัดอีก", "งานเสริม"],
  statuses: ["เกิดขึ้นแล้ว", "คาดว่าจะเกิด"],
  other: ["ใช้ฟรีในเครื่องนี้ · ไม่เชื่อมบัญชีธนาคาร", "ตัวอย่าง ไม่ใช่ยอดจริง", "ยกเลิกก่อนหมด = ไม่โดนหัก", "จ่ายไปแล้วเท่าไร จะโดนตัดอีกเท่าไร"],
};
const FORBIDDEN = ["ปฏิวัติการเงิน", "AI อัจฉริยะ", "จัดการความมั่งคั่ง", "คุณใช้เกิน", "คงเหลือโดยประมาณ", "เชื่อมบัญชีธนาคารของคุณ"];

test("A-22 locked copy is on screen and no forbidden words appear anywhere", async ({ page }) => {
  await openApp(page, "2026-10-10");
  const body = page.locator("body");
  for (const word of [...LOCKED.tabs, ...LOCKED.numbers, ...LOCKED.statuses, ...LOCKED.other]) {
    await expect(body, word).toContainText(word);
  }
  await visitAll(page, async (path) => {
    const text = await body.innerText();
    for (const bad of FORBIDDEN) expect(text, `${bad} on ${path}`).not.toContain(bad);
  });
  await expect(page.locator("body")).toContainText("เรทนี้ตั้งเอง ไม่ใช่เรทเข้าบัญชี");
});

test("A-24 keyboard only: add, edit and delete an entry; Esc closes the sheet", async ({ page }) => {
  await openApp(page, "2026-10-10");
  const expense = await statValue(page, "stat-expense");

  // Add: focus the sentence box, type, Enter, then Tab to บันทึก.
  await page.getByLabel(SENTENCE_LABEL).focus();
  await page.keyboard.type("กาแฟ 70 เงินสด");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const save = dialog.getByRole("button", { name: "บันทึก", exact: true });
  for (let i = 0; i < 40 && !(await save.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(save).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  expect(await statValue(page, "stat-expense")).toBe(expense + 70);

  // Edit: reach the list via the nav link, open the row with Enter, change the amount.
  const navLink = page.getByRole("navigation", { name: "เมนูหลัก" }).filter({ visible: true }).getByRole("link", { name: "เงินเข้า-ออก" });
  await navLink.focus();
  await page.keyboard.press("Enter");
  const row = page.getByTestId("tx-list").getByRole("button", { name: /^กาแฟ.*70/ });
  await row.focus();
  await page.keyboard.press("Enter");
  const edit = page.getByRole("dialog", { name: "แก้ไขรายการ" });
  await expect(edit).toBeVisible();
  const amount = edit.getByLabel("ยอด", { exact: true });
  await amount.focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("75");
  const editSave = edit.getByRole("button", { name: "บันทึก", exact: true });
  await editSave.focus();
  await page.keyboard.press("Enter");
  await expect(edit).toBeHidden();
  await expect(page.getByTestId("tx-list").getByRole("button", { name: /^กาแฟ.*75/ })).toBeVisible();

  // Delete: open, ลบ → confirm ลบ, all with the keyboard.
  await page.getByTestId("tx-list").getByRole("button", { name: /^กาแฟ.*75/ }).focus();
  await page.keyboard.press("Enter");
  await edit.getByRole("button", { name: "ลบ", exact: true }).focus();
  await page.keyboard.press("Enter");
  await edit.getByRole("group", { name: "ยืนยันลบ" }).getByRole("button", { name: "ลบ", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("ลบแล้ว");
  await expect(page.getByTestId("tx-list").getByRole("button", { name: /^กาแฟ.*75/ })).toHaveCount(0);

  // Esc closes and returns focus.
  const other = page.getByTestId("tx-list").getByRole("button").first();
  await other.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(other).toBeFocused();
});
