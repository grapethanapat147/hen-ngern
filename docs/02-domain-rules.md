# 02 — Domain Rules: โมเดลข้อมูลและกฎคำนวณ

> ส่วนนี้คือแกนของแอป ต้องเขียนเป็น pure functions ใน `src/domain/` และมี unit test ครบทุก Golden Case ก่อนสร้าง UI
> ถ้า UI กับเอกสารนี้ขัดกัน ให้ยึดเอกสารนี้

## 1. หลักการ

1. **เงินจริงกับคาดการณ์แยกกันเสมอ** — `Transaction` คือสิ่งที่เกิดแล้ว, `RecurringRule` คือสิ่งที่คาดว่าจะเกิด occurrence คำนวณตอนแสดงผลและไม่เก็บลงข้อมูล
2. **เงินเป็นจำนวนเต็มหน่วยย่อย** — `amountMinor` (สตางค์/เซนต์) ห้ามใช้ float กับเงิน
3. **วันที่เป็น local date string** `YYYY-MM-DD` ไม่มีเวลาและ timezone · "วันนี้" = วันที่ตามเครื่องผู้ใช้ · ห้ามใช้ `new Date("YYYY-MM-DD")` (จะถูกตีความเป็น UTC)
4. **ยอดสรุปทุกตัวคำนวณจาก transaction ที่ `status = "confirmed"` และไม่ถูกลบ** เท่านั้น
5. **ทุกฟังก์ชันคำนวณรับ `today` เป็นพารามิเตอร์** เพื่อให้ทดสอบได้

## 2. Types

```ts
export type Currency = "THB" | "USD" | "EUR";
export type TxKind = "income" | "expense" | "transfer" | "refund";
export type Cadence = "week" | "month" | "year";
export type Scope = "personal" | "work";
export type AccountType = "credit_card" | "bank" | "wallet" | "cash" | "promptpay";
export type LocalDate = string; // "YYYY-MM-DD"

export interface Account {
  id: string;
  name: string;            // "KBank Visa"
  type: AccountType;
  last4?: string;          // เฉพาะ credit_card / wallet, ตัวเลข 4 หลักเท่านั้น
  color?: string;
  hidden?: boolean;
}

export interface Transaction {
  id: string;
  kind: TxKind;
  name: string;
  amountMinor: number;     // > 0 เสมอ ทิศทางมาจาก kind
  currency: Currency;
  fxRateToThb: number;     // THB = 1 · ล็อก ณ ตอนยืนยัน
  date: LocalDate;
  categoryId?: string;     // ไม่มีสำหรับ transfer
  accountId?: string;      // income/expense/refund
  fromAccountId?: string;  // transfer
  toAccountId?: string;    // transfer
  scope: Scope;            // default "personal"
  recurringRuleId?: string;
  occurrenceDate?: LocalDate;   // occurrence ที่จับคู่
  refundOfId?: string;          // refund → expense เดิม (optional)
  note?: string;
  source: "manual" | "sentence" | "sample" | "import";
  status: "confirmed";          // v0 เก็บเฉพาะที่ยืนยันแล้ว (ร่างอยู่ใน UI state)
  createdAt: string;            // ISO
  updatedAt: string;
  deletedAt?: string;
}

export interface RecurringRule {
  id: string;
  kind: "income" | "expense";
  name: string;
  amountMinor: number;
  currency: Currency;
  cadence: Cadence;
  startsOn: LocalDate;          // วันตัด/วันรับครั้งแรก (ถ้ามี trial = วันเริ่มหัก)
  endsOn?: LocalDate;           // ไม่มี occurrence หลังวันนี้
  maxOccurrences?: number;      // นับจาก startsOn
  trialEndsOn?: LocalDate;      // ต้อง ≤ startsOn
  skippedDates?: LocalDate[];   // ผู้ใช้กด "ข้ามรอบนี้"
  categoryId: string;
  accountId?: string;
  scope: Scope;
  note?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface Settings {
  cycleStartDay: number;        // 1–28, default 1
  fx: { USD: number; EUR: number };   // default 33.25, 36.40
  sideIncomeGoalMinor: number;  // default 1_000_000 (฿10,000)
  workScopeEnabled: boolean;    // default false
}

export interface AppState {
  schemaVersion: 1;
  isSample: boolean;
  settings: Settings;
  accounts: Account[];
  transactions: Transaction[];
  rules: RecurringRule[];
}
```

Storage key: `roongern.v0` · validate ด้วย zod ตอนอ่าน · อ่านไม่ผ่าน → เก็บ raw ไว้ที่ `roongern.v0.corrupt-<timestamp>` แล้วเริ่มสมุดว่าง

## 3. หมวดหมู่ (ค่าเริ่ม, id คงที่)

| kind | id | ชื่อ |
|---|---|---|
| income | `salary` | เงินเดือน |
| income | `side` | งานเสริม |
| income | `family_in` | ครอบครัว |
| income | `other_in` | อื่น ๆ |
| expense | `software` | งาน/ซอฟต์แวร์ |
| expense | `entertainment` | บันเทิง |
| expense | `health` | สุขภาพ |
| expense | `food` | อาหาร |
| expense | `transport` | เดินทาง |
| expense | `home` | บ้าน |
| expense | `cloud` | คลาวด์ |
| expense | `music` | เพลง |
| expense | `other_out` | อื่น ๆ |

refund ใช้หมวดของ expense (ถ้า `refundOfId` มี ให้ใช้หมวดของรายการเดิม)

## 4. เงินและสกุล

- `toThbMinor(tx) = roundHalfAwayFromZero(tx.amountMinor × tx.fxRateToThb)` — ปัดต่อรายการ แล้วค่อยรวม
- ตอนยืนยันรายการ: `fxRateToThb = currency === "THB" ? 1 : settings.fx[currency]`
- เปลี่ยนเรทในตั้งค่า **ไม่เปลี่ยน** transaction เดิม · occurrence ที่คาดการณ์ใช้เรทปัจจุบันและแสดง `≈`
- แสดงผล: `฿1,234` (ไม่มีทศนิยมถ้าเป็นจำนวนเต็ม) · `US$20` · `€9.99` · ต่างสกุลแสดง `US$20 ≈ ฿665`
- parse ยอดจากผู้ใช้เป็น minor ด้วย string (ห้าม `parseFloat(x) * 100` ตรงๆ)

## 5. รอบเวลา

```
cycleFor(date, startDay):
  if date.day >= startDay → [Y-M-startDay, (M+1)-(startDay-1)]
  else                    → [(M-1)-startDay, M-(startDay-1)]
  startDay = 1            → เดือนปฏิทินปกติ
```

ป้ายรอบ: startDay = 1 → `ต.ค. 2026` · อื่น → `25 ก.ย. – 24 ต.ค.`

## 6. Occurrences ของรายการซ้ำ

- **month:** วันที่ = `min(anchorDay, วันสุดท้ายของเดือน)` โดย `anchorDay` = วันของ `startsOn` เสมอ (ไม่เลื่อนตามเดือนสั้น)
- **year:** เดือน/วันเดียวกับ `startsOn` · 29 ก.พ. → 28 ก.พ. ในปีที่ไม่ใช่อธิกสุรทิน
- **week:** ทุก 7 วันจาก `startsOn`
- ตัดทิ้งเมื่อ: ก่อน `startsOn` · หลัง `endsOn` · เกิน `maxOccurrences` · อยู่ใน `skippedDates` · rule ถูกลบ
- **สถานะ occurrence** (คำนวณ):
  - `matched` — มี transaction (ไม่ถูกลบ) ที่ `recurringRuleId` + `occurrenceDate` ตรงกัน
  - `upcoming` — ไม่ matched และ `date ≥ today`
  - `overdue` — ไม่ matched และ `date < today` และอยู่ในรอบปัจจุบัน
  - (ก่อนรอบปัจจุบันและไม่ matched → ไม่แสดงบนหน้าแรก แต่ดูได้ในปฏิทิน)

## 7. ตัวเลขสรุป (ในรอบที่เลือก)

```
รับจริง   = Σ thb(income)
จ่ายจริง  = Σ thb(expense) − Σ thb(refund)
สุทธิรอบนี้ = รับจริง − จ่ายจริง
จะตัดอีก  = Σ ≈thb(occurrence upcoming, kind=expense, today ≤ date ≤ cycleEnd)
จะเข้าอีก = Σ ≈thb(occurrence upcoming, kind=income,  today ≤ date ≤ cycleEnd)
งานเสริม  = Σ thb(income, category = "side")
```

- **transfer ไม่อยู่ในสูตรใดเลย** และไม่อยู่ใน breakdown หมวด
- **จ่ายบัตรเครดิต** = transfer จากบัญชีธนาคารไปบัตร · การรูดบัตร = expense ณ วันที่รูด
- refund ลดจ่ายจริงในรอบที่ได้เงินคืน (ไม่ย้อนไปแก้รอบเดิม) · ในหน้าเงินเข้า-ออกยังเห็นเป็นแถวของตัวเอง
- ตัวกรอง `งาน` ใช้กับทุกสูตรเหมือนกัน
- การ์ดบัญชี: `จ่ายจริงของบัญชี = Σ thb(expense ที่ accountId ตรง) − Σ thb(refund ที่ accountId ตรง)`

## 8. การจับคู่

- กด `จ่ายแล้ว`/`ได้รับแล้ว` บน occurrence → เปิดร่างที่เติม ชื่อ/ยอด/สกุล/บัญชี/หมวด/วันที่ = occurrence · ผู้ใช้แก้ยอดได้ · บันทึกแล้วตั้ง `recurringRuleId` + `occurrenceDate`
- ยอดจริงต่างจากคาดการณ์ → แสดง `ต่างจากที่คาด +฿30` บนแถวนั้น
- ร่างจากประโยคหรือฟอร์มที่: ชนิดเดียวกัน · ชื่อ normalize แล้วมีคำร่วม · วันที่ห่าง ≤ 3 วัน จาก occurrence ที่ `upcoming`/`overdue` → เสนอจับคู่ (ผู้ใช้กดยืนยันเอง)
- ยกเลิกการจับคู่ = ลบ `recurringRuleId`/`occurrenceDate` ออกจาก transaction → occurrence กลับเป็น upcoming/overdue
- 1 occurrence จับคู่ได้ 1 transaction ใน v0

## 9. Golden Cases (ต้องเป็น unit test)

ทุกเคสใช้ `today = 2026-10-01`, `cycleStartDay = 1`, fx USD 33.25 เว้นแต่ระบุ

**G1 — transfer และจ่ายบัตรไม่นับซ้ำ** (จาก brief AI Money)
บัญชี: `kbank` (bank), `scb` (bank), `ktc` (credit_card), `cash`
| รายการ | ชนิด |
|---|---|
| รับค่างาน 8,000 เข้า kbank | income |
| แท็กซี่ 220 เงินสด | expense |
| โอน 5,000 kbank → scb | transfer |
| ซื้อเครื่องมือ 399 บัตร ktc | expense |
| จ่ายยอดบัตร 399 kbank → ktc | transfer |

ผล: **รับจริง 8,000 · จ่ายจริง 619 · สุทธิ 7,381**

**G1b — refund** เพิ่ม refund 50 (`refundOfId` = แท็กซี่) → **จ่ายจริง 569 · สุทธิ 7,431** · หน้ารายการมี 6 แถว

**G2 — คาดการณ์กลายเป็นจริงครั้งเดียว**
rule Netflix 419 THB รายเดือน `startsOn 2026-09-05`
- ก่อนจ่าย: occurrence 2026-10-05 = upcoming · **จะตัดอีก 419 · จ่ายจริง 0**
- กดจ่ายแล้ว 419 วันที่ 2026-10-05: **จะตัดอีก 0 · จ่ายจริง 419**

**G3 — ยอดจริงต่างจากคาดการณ์**
rule เครื่องมือ 399 รายเดือน `startsOn 2026-10-05` · จับคู่ด้วยยอดจริง 429 → **จ่ายจริง 429 (นับครั้งเดียว)**, diff `+30`

**G4 — trial**
rule Perplexity US$20 รายเดือน `trialEndsOn 2026-10-02`, `startsOn 2026-10-02` · today `2026-09-25`
- รอบ ก.ย.: **จะตัดอีก 0** · การ์ดทดลอง `เหลือ 7 วัน`, ยอด ≈ **฿665**
- รอบ ต.ค. (today 2026-10-01): occurrence 2026-10-02 = upcoming ≈ ฿665

**G5 — วันสิ้นเดือน**
rule รายเดือน `startsOn 2026-01-31` → 2026-02-28, 2026-03-31, 2026-04-30, 2026-05-31

**G6 — จบหลัง N ครั้ง / วันสิ้นสุด**
- `startsOn 2026-07-10`, `maxOccurrences 3` → 07-10, 08-10, 09-10 · รอบ ต.ค. ไม่มี occurrence
- `startsOn 2026-07-10`, `endsOn 2026-09-30` → ผลเดียวกัน

**G7 — รอบเดือนเริ่มวันที่ 25**
- `cycleFor(2026-09-25, 25)` = 2026-09-25 → 2026-10-24
- `cycleFor(2026-09-24, 25)` = 2026-08-25 → 2026-09-24

**G8 — เรทล็อกตอนบันทึก**
transaction US$20.00 ยืนยันที่เรท 33.25 → ฿665.00 · เปลี่ยนเรทเป็น 34.00 → transaction ยังเป็น ฿665.00 · occurrence US$20 ใหม่ ≈ ฿680.00

**G9 — งานเสริมเกินเป้า**
income หมวด `side` 4,500 + 8,000 · เป้า 10,000 → งานเสริม 12,500 · ความคืบหน้า 125% (แถบเต็ม) · ข้อความ `เกินเป้า ฿2,500`

**G10 — รายสัปดาห์**
`startsOn 2026-10-01` weekly → ต.ค. มี 5 ครั้ง: 1, 8, 15, 22, 29

**G11 — ปัดเศษต่อรายการ**
3 รายการ US$0.10 ที่เรท 33.25 → รายการละ ฿3.33 (332.5 → ปัดเป็น 333 สตางค์) · รวม **฿9.99** (ไม่ใช่ ฿9.98 จากการรวมก่อนปัด)

**G12 — ลบและเลิกทำ**
ลบ expense 220 → จ่ายจริงลด 220 · เลิกทำ → กลับเท่าเดิม · occurrence ที่ matched กับรายการที่ถูกลบ → กลับเป็น upcoming/overdue
