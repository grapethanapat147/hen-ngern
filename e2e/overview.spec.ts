import { expect, test } from "@playwright/test";
import { openApp, saveDraft, SENTENCE_LABEL, statValue, typeSentence } from "./helpers";

test.describe("P3 — ภาพรวมและการจด", () => {
  test("A-1 first open: 4 numbers, sentence bar and sample banner above the fold, no sign-up", async ({ page }) => {
    await openApp(page);
    for (const id of ["stat-income", "stat-expense", "stat-net", "stat-expected"]) {
      await expect(page.getByTestId(id)).toBeInViewport({ ratio: 1 });
    }
    await expect(page.getByLabel(SENTENCE_LABEL)).toBeInViewport();
    await expect(page.getByTestId("sample-banner")).toBeInViewport();
    await expect(page.getByTestId("sample-banner")).toContainText("ตัวอย่าง ไม่ใช่ยอดจริง");
    await expect(page.getByText(/สมัคร|เข้าสู่ระบบ/)).toHaveCount(0);
  });

  test("A-2 every overview amount carries a text status", async ({ page }) => {
    await openApp(page, "2026-10-10");
    for (const id of ["stat-income", "stat-expense", "stat-net"]) {
      await expect(page.getByTestId(id)).toContainText("เกิดขึ้นแล้ว");
    }
    await expect(page.getByTestId("stat-expected")).toContainText("คาดว่าจะเกิด");
    await expect(page.getByTestId("side-income")).toContainText("เกิดขึ้นแล้ว");
    const rows = page.getByTestId("upcoming").locator("li");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) await expect(rows.nth(i)).toContainText(/คาดว่าจะเกิด|เลยกำหนด/);
  });

  test("A-3 ได้ค่างาน 4500 → income/side → รับจริง and งานเสริม +4,500", async ({ page }) => {
    await openApp(page);
    const income = await statValue(page, "stat-income");
    const sideBefore = await page.getByTestId("side-income").innerText();
    await typeSentence(page, "ได้ค่างาน 4500");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("radio", { name: "รายรับ" })).toBeChecked();
    await expect(dialog.getByLabel("หมวด")).toHaveValue("side");
    await saveDraft(page);
    expect(await statValue(page, "stat-income")).toBe(income + 4500);
    await expect(page.getByTestId("side-income")).not.toHaveText(sideBefore);
    await expect(page.getByTestId("side-income")).toContainText("฿9,000");
    await expect(page.getByLabel(SENTENCE_LABEL)).toHaveValue("");
  });

  test("A-4 monthly bill becomes a recurring rule and shows in ใกล้ตัด", async ({ page }) => {
    await openApp(page);
    const expense = await statValue(page, "stat-expense");
    await typeSentence(page, "จ่าย Netflix 419 ทุกเดือนวันที่ 5 บัตรกสิกร");
    await expect(page.getByRole("dialog")).toContainText("จะบันทึกเป็นรายการซ้ำ");
    await saveDraft(page);
    await expect(page.getByTestId("upcoming")).toContainText("Netflix");
    await expect(page.getByTestId("upcoming")).toContainText("5 ต.ค.");
    // Expected, not actual.
    expect(await statValue(page, "stat-expense")).toBe(expense);
  });

  test("A-5 transfer leaves รับจริง/จ่ายจริง unchanged", async ({ page }) => {
    await openApp(page);
    const income = await statValue(page, "stat-income");
    const expense = await statValue(page, "stat-expense");
    await typeSentence(page, "โอน 5,000 จากกสิกรไป SCB");
    await expect(page.getByRole("dialog").getByRole("radio", { name: "โอน" })).toBeChecked();
    await saveDraft(page);
    expect(await statValue(page, "stat-income")).toBe(income);
    expect(await statValue(page, "stat-expense")).toBe(expense);
  });

  test("A-6 card payment: save blocked until answered; as card payment actual expense is unchanged", async ({ page }) => {
    await openApp(page);
    const expense = await statValue(page, "stat-expense");
    await typeSentence(page, "จ่ายบัตร 8,000");
    const dialog = page.getByRole("dialog");
    const save = dialog.getByRole("button", { name: "บันทึก", exact: true });
    await expect(save).toBeDisabled();
    await expect(dialog).toContainText("รายการนี้เป็นการจ่ายยอดบัตร (โอน) หรือค่าใช้จ่ายใหม่?");
    await dialog.getByRole("button", { name: "จ่ายยอดบัตร (โอน)" }).click();
    await expect(save).toBeEnabled();
    await saveDraft(page);
    expect(await statValue(page, "stat-expense")).toBe(expense);
  });

  test("unparseable sentence shows the hint and opens nothing", async ({ page }) => {
    await openApp(page);
    await page.getByLabel(SENTENCE_LABEL).fill("ไปกินข้าว");
    await page.getByLabel(SENTENCE_LABEL).press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: "ใส่ยอด" })).toHaveText("ใส่ยอดเป็นตัวเลข เช่น จ่ายกาแฟ 65");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("Esc closes the sheet and returns focus to the sentence input", async ({ page }) => {
    await openApp(page);
    await typeSentence(page, "กาแฟ 65");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByLabel(SENTENCE_LABEL)).toBeFocused();
  });

  test("จ่ายแล้ว on an upcoming bill: actual up, expected down, once; undo restores", async ({ page }) => {
    await openApp(page, "2026-10-10");
    const expense = await statValue(page, "stat-expense");
    const expected = await statValue(page, "stat-expected");
    const row = page.getByTestId("upcoming").locator("li").filter({ hasText: "YouTube Premium" });
    await row.getByRole("button", { name: /จ่ายแล้ว/ }).click();
    await expect(page.getByRole("dialog")).toContainText("บันทึกเป็นการจ่ายรอบ YouTube Premium");
    await saveDraft(page);
    expect(await statValue(page, "stat-expense")).toBeCloseTo(expense + 179, 2);
    expect(await statValue(page, "stat-expected")).toBeCloseTo(expected - 179, 2);
    await expect(page.getByTestId("upcoming")).not.toContainText("YouTube Premium");
    await page.getByRole("status").getByRole("button", { name: "เลิกทำ" }).click();
    expect(await statValue(page, "stat-expense")).toBeCloseTo(expense, 2);
    await expect(page.getByTestId("upcoming")).toContainText("YouTube Premium");
  });

  test("A-13 typing a nearby bill offers a match; accepting counts it once", async ({ page }) => {
    await openApp(page, "2026-10-10");
    const expected = await statValue(page, "stat-expected");
    const expense = await statValue(page, "stat-expense");
    await typeSentence(page, "YouTube Premium 179");
    await page.getByRole("dialog").getByRole("button", { name: "จับคู่" }).click();
    await saveDraft(page);
    expect(await statValue(page, "stat-expense")).toBeCloseTo(expense + 179, 2);
    expect(await statValue(page, "stat-expected")).toBeCloseTo(expected - 179, 2);
  });

  test("เริ่มสมุดของฉัน asks in-page, then shows an empty book", async ({ page }) => {
    await openApp(page);
    await page.getByRole("button", { name: "เริ่มสมุดของฉัน" }).click();
    await page.getByRole("button", { name: "ยืนยัน" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await page.getByRole("link", { name: "ภาพรวม" }).click();
    await expect(page.getByTestId("sample-banner")).toHaveCount(0);
    expect(await statValue(page, "stat-income")).toBe(0);
    await expect(page.getByRole("button", { name: "ได้ค่างาน 4500" })).toBeVisible();
  });
});

test.describe("P2 storage — end to end", () => {
  test("A-D2 data survives a reload", async ({ page }) => {
    await openApp(page);
    const income = await statValue(page, "stat-income");
    await typeSentence(page, "ได้ค่างาน 1234");
    await saveDraft(page);
    await page.reload();
    await expect(page.getByTestId("stat-income")).toBeVisible();
    expect(await statValue(page, "stat-income")).toBe(income + 1234);
  });

  test("A-D3 broken storage: app opens, empty book, banner, raw backed up", async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("henngern.v0", "{broken");
        sessionStorage.setItem("seeded", "1");
      }
    });
    await openApp(page);
    await expect(page.getByRole("alert").filter({ hasText: "อ่านข้อมูลเดิม" })).toContainText("อ่านข้อมูลเดิมในเครื่องไม่ได้ เริ่มสมุดใหม่แล้ว");
    expect(await statValue(page, "stat-income")).toBe(0);
    const backups = await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith("henngern.v0.corrupt-"))
        .map((k) => localStorage.getItem(k)),
    );
    expect(backups).toEqual(["{broken"]);
  });
});
