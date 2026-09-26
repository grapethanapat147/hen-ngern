# 08 — QA report: v0 acceptance (P7)

วันที่รัน: 26 ก.ย. 2026 · branch `claude/new-project-tasks-9gk8ct` · ผู้รัน: Claude Code
สภาพแวดล้อม: Chromium (Playwright 1.63) บน Linux sandbox · production build (`next build && next start`) · 2 viewport: **390×844** และ **1280×800** · นาฬิกาในเบราว์เซอร์ตรึงไว้ที่ 1 หรือ 10 ต.ค. 2026 เพื่อให้ผลซ้ำได้

## ผลรวม

| ชุดทดสอบ | ผล |
|---|---|
| Unit (Vitest) | **166 / 166 ผ่าน** — Golden Cases G1–G12, parser P1–P18, storage, rules, calendar, CSV |
| E2E (Playwright) | **116 / 116 ผ่าน** (58 spec × 2 viewport) |
| axe (serious/critical) | **0** ทั้ง 5 หน้า + sheet ตรวจร่าง ทั้ง 2 viewport |
| typecheck · lint · build | ผ่าน |

## รายข้อ (`docs/05-acceptance.md`)

สถานะ: ✅ ผ่าน (มี test อัตโนมัติ) · ⚠️ ผ่านบางส่วน / ต้องตรวจด้วยคน · ❌ ไม่ผ่าน

| # | สถานะ | หลักฐาน |
|---|---|---|
| A-D1 | ✅ | `src/domain/__tests__/golden.test.ts`, `parser.test.ts` |
| A-D2 | ✅ | `e2e/overview.spec.ts` "A-D2 data survives a reload" + unit ใน `repository.test.ts` |
| A-D3 | ✅ | `e2e/overview.spec.ts` "A-D3 broken storage…" + `repository.test.ts`, `store.test.ts` |
| A-D4 | ✅ | `e2e/calendar-settings.spec.ts` "A-D4 export JSON…import…" + `repository.test.ts` |
| A-1 | ✅ | `e2e/overview.spec.ts` (ตรวจ `toBeInViewport` ที่ 390×844) |
| A-2 | ✅ | `e2e/overview.spec.ts` · รายการเลยกำหนดใช้ป้าย `เลยกำหนด` (decision log) |
| A-3 | ✅ | `e2e/overview.spec.ts` |
| A-4 | ✅ | ภาพรวม: `overview.spec.ts` · รายการซ้ำ: `recurring.spec.ts` ("+ บิลซ้ำ") · ปฏิทิน: `calendar-settings.spec.ts` |
| A-5 | ✅ | `e2e/overview.spec.ts` |
| A-6 | ✅ | `e2e/overview.spec.ts` + `src/lib/__tests__/drafts.test.ts` |
| A-7 | ✅ | `e2e/transactions.spec.ts` (ผลรวม header เทียบกับผลรวมแถวที่เห็น) |
| A-8 | ✅ | `e2e/transactions.spec.ts` |
| A-9 | ✅ | `e2e/transactions.spec.ts` + `store.test.ts` |
| A-10 | ✅ | `e2e/transactions.spec.ts` + `list.test.ts` |
| A-11 | ✅ | `e2e/recurring.spec.ts`, `overview.spec.ts` (จ่ายแล้ว + เลิกทำ) |
| A-12 | ✅ | `e2e/recurring.spec.ts` (+฿10 ในตัวอย่าง, +฿20 จากการจ่ายจริง) |
| A-13 | ✅ | `e2e/overview.spec.ts` + `units.test.ts` |
| A-14 | ✅ | `e2e/recurring.spec.ts` + G4 |
| A-15 | ✅ | `e2e/recurring.spec.ts` + G6 + `rules.test.ts` |
| A-16 | ✅ | `e2e/calendar-settings.spec.ts` + `calendar.test.ts` |
| A-17 | ✅ | `e2e/calendar-settings.spec.ts` (ไม่มีเซลล์ล้น, ไม่มี scroll แนวนอน) |
| A-18 | ✅ | `e2e/calendar-settings.spec.ts` |
| A-19 | ✅ | `e2e/calendar-settings.spec.ts` + G7 |
| A-20 | ✅ | `e2e/calendar-settings.spec.ts` + schema ปฏิเสธ last4 ที่ไม่ใช่ 4 หลัก (`repository.test.ts`) |
| A-21 | ⚠️ | อัตโนมัติ: BOM `EF BB BF`, CRLF, หัวคอลัมน์ไทย, escape, กันสูตร (`calendar.test.ts`, `calendar-settings.spec.ts`) · **ยังไม่ได้เปิดใน Excel / Google Sheets จริง** (ไม่มีใน sandbox) |
| A-22 | ✅ | `e2e/qa.spec.ts` (copy ที่ล็อกอยู่บนจอ, ไม่มีคำต้องห้ามทั้ง 5 หน้า) + grep ใน `src/` |
| A-23 | ✅ | `e2e/transactions.spec.ts` + `units.test.ts` (ทุกความเห็นมี sourceIds) |
| A-24 | ✅ | `e2e/qa.spec.ts` (เพิ่ม → แก้ → ลบ ด้วย keyboard ล้วน, Esc คืน focus) |
| A-25 | ✅ | `e2e/a11y.spec.ts` (ทั้ง 5 หน้า + sheet) |
| A-26 | ✅ | `e2e/qa.spec.ts` (ดักทุก request ระหว่างใช้งาน 5 หน้า + จดรายการ → 0 request นอก origin) + CSP `default-src 'self'` · ตรวจแล้วว่าถ้ามีโค้ดเรียกโดเมนนอก test จะล้ม |

**ไม่มีข้อที่ไม่ผ่าน** · 1 ข้อต้องตรวจด้วยคน (A-21 ใน Excel/Sheets)

## สิ่งที่ยังไม่ได้ทดสอบ

- เบราว์เซอร์อื่นนอกจาก Chromium (Safari iOS, Firefox) และมือถือจริง — Safari มีพฤติกรรม `<dialog>`, `input type=date` และ private mode ต่างออกไป
- Screen reader จริง (VoiceOver / TalkBack) — ตรวจแค่ด้วย axe และ role/label ใน test
- IME ภาษาไทยจริงระหว่างพิมพ์ (โค้ดเช็ก `isComposing` แล้ว แต่ไม่ได้ทดสอบกับคีย์บอร์ดไทยจริง)
- ข้อมูลปริมาณมาก (หลายพันรายการ) — ยังไม่ได้วัดความเร็ว
- ทดสอบกับผู้ใช้จริง — ตามแผน `06-experiment-plan.md` หลัง deploy preview

## ตรวจโค้ดตามกฎโปรเจกต์ (grep, 26 ก.ย. 2026)

| กฎ | ผล |
|---|---|
| ห้าม `new Date("YYYY-MM-DD")` | ไม่พบ (มีแค่ในคอมเมนต์) |
| ห้ามใช้ float กับเงิน (`parseFloat`, `toFixed`) | ไม่พบ · การคูณ/หาร 100 ที่เหลือเป็นการแสดงผลและเปอร์เซ็นต์ |
| ห้าม `alert()` / `confirm()` / `prompt()` | ไม่พบ |
| ห้ามเรียก network ภายนอก | ไม่มี `fetch` หรือ URL ภายนอกใน `src/` · CSP บล็อกซ้ำอีกชั้น |
| คำต้องห้ามใน §7 | ไม่พบ |
