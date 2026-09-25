# Decision log

บันทึกการตัดสินใจระหว่าง build ที่ไม่ได้อยู่ใน `00-decision-review.md` · ใหม่อยู่บนสุด

| วันที่ | เรื่อง | ตัดสิน | เหตุผล | ใครตัดสิน |
|---|---|---|---|---|
| 2026-09-25 | เปลี่ยนชื่อสินค้า | **เห็นเงิน** (แทน รู้เงิน) · package `henngern` · storage key `henngern.v0` · โลโก้ชั่วคราวใช้คำว่า เห็น · tagline §1 ยังเป็นของเดิม ("เห็นเงินเข้า เงินออก…") ซ้ำคำกับชื่อ รอ Grape ตัด/แก้ · ไฟล์ใน `docs/reference/` ไม่แก้ (เป็นต้นฉบับ) | ตรงกับชื่อ repo · เปลี่ยนก่อน P3 ต้นทุนต่ำ · ยังไม่ได้เช็กเครื่องหมายการค้า/โดเมน (T2) | Grape |
| 2026-09-25 | P0 tooling | bun · Next.js 16.3 · Tailwind v4 · Vitest (`src/**/*.test.ts`) · Playwright 2 projects (390×844, 1280×800) · `typecheck` รัน `next typegen` ก่อน `tsc` เพราะ `LayoutProps` เป็น type ที่ Next generate | ตาม CLAUDE.md Stack · Next 16 ต้อง generate route types ก่อน typecheck | Claude |
| 2026-09-25 | ชื่อ, AI ใน v0, stack | รู้เงิน · ไม่มี LLM ใน v0 · Next.js + TS | ดู 00-decision-review.md D1, D3, D4 | Grape |
