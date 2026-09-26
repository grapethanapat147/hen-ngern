# Prompt 00 — Kickoff (P0 Setup)

ใช้เมื่อ: เปิด Claude Code ครั้งแรกที่ root ของ repo `quizloop` · คัดลอกทุกอย่างใต้เส้นไปวาง

---

คุณเป็น implementation partner และ independent reviewer ของโปรเจกต์ Quiz Loop ใน repo นี้ ผมคือ Grape เป็น PM และคนตัดสินใจ

**ก่อนลงมือ**
1. อ่าน `CLAUDE.md` แล้วอ่าน `docs/00-decision-review.md`, `docs/01-product-brief.md`, `docs/03-ux-spec-v1.md`, `docs/05-build-plan.md` ให้ครบ ไฟล์อื่นใน `docs/` อ่านเมื่อจำเป็น
2. สรุปกลับมาไม่เกิน 8 บรรทัด: ผลิตภัณฑ์คืออะไร, สิ่งที่ล็อกแล้ว, ทำไม build ถึงถูก gate, เฟสที่ทำได้ตอนนี้
3. ชี้ความขัดแย้งหรือช่องโหว่ระหว่างเอกสารที่จะกระทบการ build เรียงตามผลกระทบ ถ้าไม่มีให้บอกว่าไม่มี — ยังไม่ต้องแก้เอกสาร ให้เสนอแล้วรอผม
4. ตรวจเครื่อง: เวอร์ชัน `bun`, `node`, `git` และมี `supabase` CLI / Docker หรือไม่ ถ้าไม่มีให้บอกวิธีติดตั้ง อย่าติดตั้งเองโดยไม่ถาม

**จากนั้นทำ P0 Setup ใน `docs/05-build-plan.md` เท่านั้น**
- ทำทุกข้อใน checklist ของ P0
- `create-next-app` อาจไม่ยอมลงในโฟลเดอร์ที่มีไฟล์อยู่แล้ว ให้ scaffold ในโฟลเดอร์ชั่วคราวแล้วย้ายเข้ามา ห้ามทับ `CLAUDE.md`, `README.md`, `docs/`, `prompts/`, `.env.example`
- รัน `dev` (เช็กว่าขึ้น), `typecheck`, `lint`, `test` ให้ผ่าน
- เติมส่วน Commands ใน `CLAUDE.md` และส่วน Setup ใน `README.md`
- บันทึกการเลือกฟอนต์และเวอร์ชันของ library หลักใน `docs/decision-log.md`
- commit

ห้ามเริ่ม P1 ขึ้นไป ห้ามสร้าง UI ของเกม และห้ามเรียก AI API

**จบด้วยรายงานภาษาไทย**
- สิ่งที่ทำ (ไฟล์/โฟลเดอร์หลัก)
- คำสั่งที่รันพร้อมผล (tested) และสิ่งที่ยังไม่ได้ทดสอบ (not tested)
- สิ่งที่ต้องการจากผมก่อน P2 (Supabase project, Google OAuth ฯลฯ)
- คำถามที่ต้องให้ผมตัดสิน ไม่เกิน 3 ข้อ
