# 03 — Parser Spec: แปลงประโยคไทยเป็นร่างรายการ (v0 ไม่ใช้ LLM)

> `src/domain/parser/` · pure function `parseSentence(text, ctx) → Draft[]` · `ctx = { today, accounts, settings }`
> ผลลัพธ์เป็น **ร่าง** เสมอ ไม่บันทึกเอง · ทุกช่องที่เดามีธง `uncertain`

## 1. Output

```ts
interface Draft {
  kind: "income" | "expense" | "transfer" | "refund" | null;  // null = ต้องถาม
  name: string;
  amountMinor: number | null;
  currency: Currency;
  date: LocalDate;
  cadence: "once" | Cadence;
  dayOfMonth?: number;
  trialEndsOn?: LocalDate;
  categoryId?: string;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  scope: Scope;
  uncertain: Array<"kind" | "amount" | "name" | "category" | "account" | "date">;
  question?: "card_payment_or_expense" | "transfer_or_expense";
}
```

แปลงไม่ได้ (ไม่พบตัวเลข) → คืน `[]` แล้ว UI แสดง `ใส่ยอดเป็นตัวเลข เช่น จ่ายกาแฟ 65`

## 2. ลำดับการทำงาน

1. **Normalize:** แปลงเลขไทย ๐–๙ → 0–9 · ตัด `,` ออกจากตัวเลข · lower-case ตัวละติน · ยุบช่องว่าง
2. **แยกหลายรายการ:** ขึ้นบรรทัด · `,` ที่ไม่อยู่ในตัวเลข · `;` · ` และ `
3. ต่อ 1 ชิ้น: หา **ยอด** → **สกุล** → **ชนิด** → **รอบ/วัน** → **บัญชี** → **หมวด** → **ชื่อ** (ส่วนที่เหลือ)

## 3. กฎ

### ยอด
- ตัวเลขแรกที่ไม่ใช่ส่วนของวันที่ (`วันที่ 5`, `ถึง 2 ต.ค.`, `5 ต.ค.`) และไม่ใช่ 4 ตัวท้ายบัตร (`•••• 4529`, `ลงท้าย 4529`)
- หน่วยคูณ: `k` / `K` **ต้องไม่ตามด้วยตัวอักษร** (กัน `35000 kbank` → 35 ล้าน) · `พัน` ×1,000 · `หมื่น` ×10,000 · `แสน` ×100,000
- ทศนิยมได้ 2 ตำแหน่ง · ไม่มีตัวเลข → ไม่สร้างร่าง · ยอด 0 → ร่างที่ `amount` uncertain

### สกุล
- `$`, `usd`, `ดอลลาร์`, `ดอล` → USD · `€`, `eur`, `ยูโร` → EUR · อื่นๆ → THB

### ชนิด
| สัญญาณ | ชนิด |
|---|---|
| ขึ้นต้น `ได้`, `รับ`, `เงินเดือน`, `โอนเข้า`, `เงินเข้า`, `ค่าจ้าง`, `โบนัส` | income |
| `คืนเงิน`, `ได้เงินคืน`, `refund` | refund |
| `โอน … ไป …` / `โอน … จาก … ไป …` และจับคู่บัญชีของผู้ใช้ได้ทั้งสองฝั่ง | transfer |
| `โอน` แต่จับบัญชีปลายทางไม่ได้ | `null` + `question: "transfer_or_expense"` |
| `จ่ายบัตร`, `ชำระบัตร`, `จ่ายยอดบัตร` | `null` + `question: "card_payment_or_expense"` |
| ขึ้นต้น `จ่าย`, `ค่า`, `ซื้อ`, `ทดลอง`, `เติม` | expense |
| ไม่มีสัญญาณ | expense + uncertain `kind` |
| ขึ้นต้น `ค่า` แต่หมวดที่จับได้เป็นหมวดรายรับ (เช่น `ค่างาน`, `ค่าจ้าง`) | income + uncertain `kind` |

### รอบและวัน
- `ทุกเดือน`, `รายเดือน`, `เดือนละ` → month · `ทุกปี`, `รายปี`, `ปีละ` → year · `ทุกสัปดาห์`, `รายสัปดาห์`, `อาทิตย์ละ` → week · อื่นๆ → once
- `เงินเดือน` เป็นหมวด **ไม่ใช่** สัญญาณรอบ (ต่างจาก brief A: "เงินเดือนเข้า 45000" คือรายการครั้งเดียวที่เกิดแล้ว)
- `วันที่ N` → `dayOfMonth` · ถ้า once = วันที่ N ของเดือนนี้ · ถ้า month = startsOn คือวันที่ N ครั้งถัดไปที่ ≥ วันนี้
- `วันนี้` → today · `เมื่อวาน` → −1 · `เมื่อวานซืน` → −2 · `พรุ่งนี้` → +1
- `N ต.ค.` / `N ตุลาคม` / `N/10` → วันที่ในปีปัจจุบัน (ถ้าเป็น trial หรือรายการซ้ำและวันผ่านไปแล้ว → ปีถัดไป)
- ปี พ.ศ. (≥ 2400) → ลบ 543
- `ทดลอง … ถึง <วันที่>` → expense + cadence month (ถ้าไม่ได้ระบุ) + `trialEndsOn` = วันที่นั้น + `startsOn` = วันที่นั้น

### บัญชี (จับคู่กับบัญชีของผู้ใช้ด้วย alias)
| alias | ตัวอย่างบัญชี |
|---|---|
| `กสิกร`, `kbank`, `k plus`, `kplus` | ชื่อบัญชีมี KBank/กสิกร |
| `scb`, `ไทยพาณิชย์`, `scb easy` | SCB |
| `กรุงไทย`, `ktb`, `เป๋าตัง` | Krungthai |
| `กรุงเทพ`, `bbl` | Bangkok Bank |
| `ktc`, `บัตร ktc` | KTC |
| `truemoney`, `ทรูมันนี่`, `tmn`, `วอลเล็ต` | TrueMoney |
| `เงินสด`, `cash` | cash |
| `พร้อมเพย์`, `promptpay` | promptpay |
| ตัวเลข 4 หลักที่ตรง `last4` | บัญชีนั้น |

ไม่พบ → บัญชีเงินสดถ้ามี + uncertain `account` · ห้ามสร้างบัญชีใหม่เอง

### หมวด (พจนานุกรม, จับคำแรกที่พบ)
| หมวด | คำ |
|---|---|
| software | claude, chatgpt, openai, notion, github, copilot, figma, canva, adobe, perplexity, cursor, midjourney |
| entertainment | netflix, youtube, disney, hbo, viu, wetv, trueid, major, หนัง, เกม, คอนเสิร์ต |
| music | spotify, apple music, joox |
| cloud | icloud, google one, dropbox, onedrive |
| health | fitness, ฟิตเนส, ยา, หมอ, คลินิก, โรงพยาบาล, gym |
| food | กาแฟ, ข้าว, อาหาร, ก๋วยเตี๋ยว, ชา, ส้มตำ, grab food, lineman, 7-11, เซเว่น, ขนม, หมูกระทะ |
| transport | bts, mrt, แท็กซี่, taxi, grab, bolt, วิน, น้ำมัน, ทางด่วน |
| home | ค่าเช่า, ค่าห้อง, ค่าไฟ, ค่าน้ำ, ค่าเน็ต, ais, true, dtac |
| salary | เงินเดือน |
| side | ค่างาน, งานเสริม, ฟรีแลนซ์, ค่าจ้าง, พาร์ตไทม์, mercor |

ไม่พบ → `other_out` / `other_in` + uncertain `category` · `grab food` ต้องเช็กก่อน `grab`

### ชื่อ
ข้อความที่เหลือหลังตัด ยอด หน่วย สกุล คำบอกชนิดที่ขึ้นต้น คำบอกรอบ วันที่ และ alias บัญชี · trim · ถ้าว่าง → ใช้ชื่อหมวด + uncertain `name`

## 4. Test cases (ต้องเป็น unit test)

`today = 2026-10-01` · บัญชี: KBank Visa (••4529), SCB Mastercard (••8812), TrueMoney (••7127), เงินสด

| # | ข้อความ | ผลที่ต้องได้ |
|---|---|---|
| P1 | `ได้ค่างาน 4500` | income · 4,500 THB · side · once · วันนี้ |
| P2 | `จ่าย Netflix 419 ทุกเดือนวันที่ 5 บัตรกสิกร` | expense · 419 · entertainment · month · startsOn 2026-10-05 · KBank |
| P3 | `ทดลอง Perplexity 20 ดอลลาร์ ถึง 2 ต.ค.` | expense · US$20 · software · month · trialEndsOn = startsOn = 2026-10-02 |
| P4 | `เงินเดือนเข้า 35000 kbank` | income · **35,000** (ไม่ใช่ 35,000,000) · salary · **once** · KBank |
| P5 | `กาแฟ 65 tmn, ข้าวมันไก่ 50 เงินสด` | 2 ร่าง: food 65 TrueMoney · food 50 เงินสด |
| P6 | `โอน 5,000 จากกสิกรไป SCB` | transfer · 5,000 · from KBank → to SCB |
| P7 | `โอน 2500` | kind null · question transfer_or_expense |
| P8 | `จ่ายบัตร 8,000` | kind null · question card_payment_or_expense |
| P9 | `แท็กซี่ 220 เมื่อวาน` | expense · transport · 2026-09-30 · uncertain kind |
| P10 | `ได้เงินคืน grab 50` | refund · 50 · transport |
| P11 | `Claude 20$ ทุกเดือน 4529` | expense · US$20 · software · month · KBank (จาก last4) · 4529 ไม่ถูกอ่านเป็นยอด |
| P12 | `ค่าเช่า 6.5k ทุกเดือนวันที่ 1` | expense · 6,500 · home · month · startsOn 2026-10-01 |
| P13 | `iCloud 1,188 ทุกปี` | expense · 1,188 · cloud · year |
| P14 | `ส้มตำ ๖๐` | expense · 60 · food |
| P15 | `ไปกินข้าว` | `[]` (ไม่มีตัวเลข) |
| P16 | `ค่างาน 1.5 หมื่น` | income · 15,000 · side (คำว่า `ค่า` ปกติแปลว่ารายจ่าย แต่ถ้าคำที่จับได้เป็นหมวดรายรับ ให้เป็นรายรับ + uncertain `kind`) |
| P17 | `grab food 189` | expense · food (ไม่ใช่ transport) |
| P18 | `จ่าย 0` | 1 ร่าง · amount uncertain · บันทึกไม่ได้ |

## 5. Eval สำหรับ v0.1

เก็บประโยคจริงจากการทดสอบผู้ใช้ (ได้รับอนุญาต ลบข้อมูลส่วนตัวแล้ว) ≥ 100 ประโยค → วัด parser v0 เป็น baseline (ชนิดถูก, ยอดถูก, บัญชีถูก, หมวดถูก) · LLM ใน v0.1 ต้องชนะ baseline ชัดเจน จึงจะคุ้มต้นทุน
