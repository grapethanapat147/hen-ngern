# เห็นเงิน (henngern)

ชุดเอกสารสำหรับเริ่มโปรเจกต์ใหม่ใน Claude Code · ยังไม่มีโค้ด (Claude Code จะ scaffold ในเฟส P0)

## วิธีใช้

1. แตก zip ไปไว้ในโฟลเดอร์ว่าง เช่น `~/Projects/hen-ngern`
2. `cd ~/Projects/hen-ngern && git init && git add . && git commit -m "docs: starter kit"`
3. เปิด `claude` ในโฟลเดอร์นั้น
4. วาง prompt "เริ่มโปรเจกต์" จาก `docs/kickoff-prompts.md`
5. ทำทีละเฟส รอรายงานก่อนสั่งเฟสถัดไป

> `create-next-app` ต้องการโฟลเดอร์ว่าง ถ้ามันไม่ยอมเพราะมีไฟล์อยู่แล้ว ให้ Claude Code scaffold ในโฟลเดอร์ชั่วคราวแล้วย้ายไฟล์เข้ามา

## ในชุดนี้มีอะไร

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `CLAUDE.md` | กติกาโปรเจกต์ที่ Claude Code อ่านทุกครั้ง: สิ่งที่ล็อก, stack, โครงสร้าง, definition of done |
| `docs/00-decision-review.md` | ผลวิเคราะห์ 3 briefs, ช่องโหว่ที่เจอ, decisions D1–D16, คะแนน Stage 3 |
| `docs/01-product-brief.md` | หน้าจอ, states, copy ที่ล็อก, visual tokens |
| `docs/02-domain-rules.md` | โมเดลข้อมูล, สูตรคำนวณ, Golden Cases G1–G12 (ความจริงของตัวเลข) |
| `docs/03-parser-spec.md` | กฎแปลงประโยคไทย + test cases P1–P18 |
| `docs/04-build-plan.md` | เฟส P0–P7 และ roadmap v0.1–v0.3 |
| `docs/05-acceptance.md` | เกณฑ์รับงาน A-D1…A-26 |
| `docs/06-experiment-plan.md` | แผน user test 8 คน + pilot + decision gate |
| `docs/kickoff-prompts.md` | prompt สำหรับแต่ละเฟส |
| `docs/decision-log.md` | บันทึกการตัดสินใจระหว่าง build |
| `docs/07-next-tasks.md` | งานที่ต้องทำเพิ่ม (design system, mascot, ชื่อ) รอ Grape ตัดสิน |
| `docs/08-qa-report.md` | ผล acceptance รายข้อ (P7) |
| `docs/09-deploy-vercel.md` | ขั้นตอน deploy preview ให้ Grape กดเอง |
| `docs/reference/` | brief ต้นฉบับทั้ง 3 ฉบับ + ภาพหน้าจอ Billbau (อ้างอิงเท่านั้น ห้ามลอก) |

## สถานะ (26 ก.ย. 2026)

- **v0 P0–P7 เสร็จในโค้ด** · unit 166 ข้อ + e2e 116 ข้อ ผ่าน · acceptance A-D1…A-26 ผ่านทุกข้อ (A-21 ยังต้องเปิดใน Excel/Sheets ด้วยคน) → `docs/08-qa-report.md`
- **ยังไม่ได้ deploy** — ขั้นตอนให้ Grape กดเองอยู่ที่ `docs/09-deploy-vercel.md`
- **ยังไม่ได้ทดสอบกับผู้ใช้** — แผนอยู่ที่ `docs/06-experiment-plan.md`
- Stage 3: TEST (66/100) — จะเปลี่ยนได้หลัง user test ตาม decision gate

## คำสั่ง

```bash
bun install
bun dev                 # http://localhost:3000
bun run test            # unit (Vitest)
bun run test:e2e        # Playwright 390×844 + 1280×800 (build + start บน :3100)
bun run typecheck && bun run lint
```
