// UI copy. Items marked LOCKED come from docs/01-product-brief.md §7 — change only with Grape's approval.

export const PRODUCT_NAME = "เห็นเงิน"; // LOCKED (D1)
/** Placeholder until Grape picks a tagline (docs/decision-log.md). */
export const TAGLINE = "เงินเข้า เงินออก และวันตัด ในก้อนเดียว";

export const TABS = [
  { href: "/", label: "ภาพรวม" },
  { href: "/transactions", label: "เงินเข้า-ออก" },
  { href: "/recurring", label: "รายการซ้ำ" },
  { href: "/calendar", label: "ปฏิทิน" },
  { href: "/settings", label: "เป้า" },
] as const; // LOCKED labels

export const STATUS = {
  actual: "เกิดขึ้นแล้ว",
  expected: "คาดว่าจะเกิด",
  review: "รอตรวจ",
  overdue: "เลยกำหนด",
} as const; // LOCKED

export const POLICY_SHORT = "ใช้ฟรีในเครื่องนี้ · ไม่เชื่อมบัญชีธนาคาร"; // LOCKED
export const SAMPLE_LABEL = "ตัวอย่าง ไม่ใช่ยอดจริง"; // LOCKED
export const TRIAL_HINT = "ยกเลิกก่อนหมด = ไม่โดนหัก"; // LOCKED
export const OUT_OVER_IN = "รอบนี้เงินออกมากกว่าเข้า ลองดูรายการซ้ำที่ยังใช้อยู่";

export const SENTENCE = {
  label: "พิมพ์เป็นประโยค แล้วตรวจร่างก่อนบันทึก",
  button: "แปลง",
  error: "ใส่ยอดเป็นตัวเลข เช่น จ่ายกาแฟ 65",
  placeholders: [
    "ได้ค่างาน 4,500 เข้ากสิกร",
    "จ่าย Netflix 419 ทุกเดือนวันที่ 5 บัตรกสิกร",
    "ทดลอง Perplexity 20 ดอลลาร์ ถึง 2 ต.ค.",
    "โอน 5,000 จากกสิกรไป SCB",
  ],
  examples: ["ได้ค่างาน 4500", "กาแฟ 65 เงินสด", "จ่าย Netflix 419 ทุกเดือนวันที่ 5"],
} as const;

export const QUESTIONS = {
  card_payment_or_expense: {
    text: "รายการนี้เป็นการจ่ายยอดบัตร (โอน) หรือค่าใช้จ่ายใหม่?",
    transfer: "จ่ายยอดบัตร (โอน)",
    expense: "ค่าใช้จ่ายใหม่",
  },
  transfer_or_expense: {
    text: "โอนให้คนอื่น (รายจ่าย) หรือโอนเข้าบัญชีของคุณเอง?",
    transfer: "โอนเข้าบัญชีของคุณเอง",
    expense: "โอนให้คนอื่น (รายจ่าย)",
  },
} as const; // LOCKED questions

export const BANNERS = {
  sample: SAMPLE_LABEL,
  startOwn: "เริ่มสมุดของฉัน",
  startOwnConfirm: "ลบข้อมูลตัวอย่างทั้งหมดแล้วเริ่มสมุดว่าง?",
  recovered_corrupt: "อ่านข้อมูลเดิมในเครื่องไม่ได้ เริ่มสมุดใหม่แล้ว",
  storage_unavailable: "เบราว์เซอร์นี้ไม่ให้บันทึก ข้อมูลจะหายเมื่อปิดหน้า",
  save_failed: "บันทึกลงเครื่องไม่สำเร็จ พื้นที่ในเบราว์เซอร์อาจเต็ม",
} as const;

export const KIND_LABEL = { income: "รายรับ", expense: "รายจ่าย", transfer: "โอน", refund: "คืนเงิน" } as const;
export const CADENCE_LABEL = { once: "ครั้งเดียว", week: "ทุกสัปดาห์", month: "ทุกเดือน", year: "ทุกปี" } as const;
