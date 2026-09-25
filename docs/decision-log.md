# Decision log

บันทึกการตัดสินใจระหว่าง build ที่ไม่ได้อยู่ใน `00-decision-review.md` · ใหม่อยู่บนสุด

| วันที่ | เรื่อง | ตัดสิน | เหตุผล | ใครตัดสิน |
|---|---|---|---|---|
| 2026-09-25 | ชื่อ repo `hen-ngern` ≠ ชื่อสินค้า รู้เงิน | คงชื่อสินค้า **รู้เงิน** ตาม D1 ใน UI/เอกสาร · ใช้ package name `roongern` · ข้อเสนอชื่อใหม่อยู่ใน `07-next-tasks.md` §3 รอ Grape ตัดสิน | D1 ล็อกไว้ · ห้ามเปลี่ยนชื่อสินค้าโดยไม่ถาม | Claude (รอ Grape ยืนยัน) |
| 2026-09-25 | P0 tooling | bun · Next.js 16.3 · Tailwind v4 · Vitest (`src/**/*.test.ts`) · Playwright 2 projects (390×844, 1280×800) · `typecheck` รัน `next typegen` ก่อน `tsc` เพราะ `LayoutProps` เป็น type ที่ Next generate | ตาม CLAUDE.md Stack · Next 16 ต้อง generate route types ก่อน typecheck | Claude |
| 2026-09-25 | ชื่อ, AI ใน v0, stack | รู้เงิน · ไม่มี LLM ใน v0 · Next.js + TS | ดู 00-decision-review.md D1, D3, D4 | Grape |
