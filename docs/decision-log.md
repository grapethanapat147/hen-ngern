# Decision Log

บันทึกการตัดสินใจระหว่าง build ที่ไม่ได้อยู่ใน `00`–`05` · เรื่องที่แก้สิ่งที่ล็อกไว้ต้องมีชื่อ Grape ในช่อง "อนุมัติโดย"

| วันที่ | เรื่อง | ตัดสิน | เหตุผล | อนุมัติโดย |
|---|---|---|---|---|
| 2026-09-26 | Build gating | P0 ทำได้ทันที · P1–P4 ต้องให้ Grape ยืนยันเงื่อนไข · P5–P6 หลัง Gate 1 | `00` คำตัดสินรอบ 2 | Grape (รอยืนยันใน session แรก) |
| 2026-09-26 | Font | `Sarabun` (Google Fonts ผ่าน `next/font`, subsets thai+latin, weight 400/500/600/700, `display: swap`) เป็นฟอนต์เดียวทั้ง UI | ครูและนักเรียนคุ้นจากเอกสารราชการ (ตระกูล TH Sarabun) · แบบมีหัว อ่านง่ายสำหรับ ม.ต้น · ครอบคลุมไทย+ละติน+ตัวเลขในตระกูลเดียว ไม่ต้องจับคู่ฟอนต์ · เปลี่ยนได้ที่ `src/app/layout.tsx` จุดเดียว · ยังไม่ทดสอบการอ่านจากท้ายห้อง (P4) | Claude (Grape ทบทวนได้) |
| 2026-09-26 | Library versions (P0) | Next 16.3.6 (App Router, Turbopack) · React 19.2.8 · TypeScript 5.9.3 · Tailwind 4.3.3 · framer-motion 13.4.4 · zod 4.6.5 · lucide-react 1.48.0 · Vitest 5.0.2 + jsdom + Testing Library · Playwright 1.63.0 + @axe-core/playwright 4.13.0 · supabase CLI 2.118.0 (devDependency) · Bun 1.3.11 | ใช้ค่า latest ณ วันตั้งค่า · ล็อกด้วย `bun.lock` · zod 4 เป็น major ใหม่ ต้องใช้ API ของ v4 ตอนเขียน schema ใน P1/P5 | Claude |
| 2026-09-26 | shadcn/ui init แบบ manual | เขียน `components.json` (style new-york, base neutral, css variables), token ใน `src/app/globals.css` และ `cn()` ใน `src/lib/utils.ts` เอง ยังไม่เพิ่ม component | เครื่องที่ใช้ตั้งค่าเข้าถึง `ui.shadcn.com` ไม่ได้ (network policy 403) · ต้องตรวจบนเครื่อง Grape ด้วย `bunx shadcn@latest add button` ว่า config เข้ากันได้ | Claude |
| 2026-09-26 | Supabase CLI เป็น devDependency | เพิ่มแพ็กเกจ `supabase` ใน devDependencies และเรียกผ่าน `bun run db:*` แทนติดตั้ง global | เครื่องตั้งค่าไม่มี CLI · ทุกเครื่องได้เวอร์ชันเดียวกันจาก lockfile · ไม่แตะเครื่องของ Grape | Claude |
| 2026-09-26 | `AGENTS.md` ของ Next | เก็บไฟล์ที่ `create-next-app` สร้างไว้ใน repo | `next dev` เขียน block กฎของ Next ลง `AGENTS.md` เมื่อมีไฟล์นี้ และจะไม่แตะ `CLAUDE.md` · ถ้าลบ Next จะเขียนลง `CLAUDE.md` แทน | Claude |
| 2026-09-26 | Playwright browser | `playwright.config.ts` รับ `PLAYWRIGHT_CHROMIUM_PATH` เพื่อชี้ Chromium ของระบบ ถ้าไม่ตั้งใช้ browser ที่ Playwright ดาวน์โหลดตามปกติ | เครื่องตั้งค่าห้ามดาวน์โหลด browser · ค่าเริ่มต้นบนเครื่อง Grape ไม่เปลี่ยน | Claude |
| 2026-09-26 | Reduced motion (global) | `globals.css` ปิด animation/transition ทั้งหมดเมื่อ `prefers-reduced-motion: reduce` | Non-negotiable 7 · framer-motion ต้องเคารพเพิ่มเติมผ่าน `useReducedMotion` ใน P3 | Claude |
