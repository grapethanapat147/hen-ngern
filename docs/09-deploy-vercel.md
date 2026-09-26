# 09 — Deploy preview บน Vercel (Grape กดเอง)

> Claude Code **ไม่ได้ deploy** · เอกสารนี้คือขั้นตอนให้ Grape ทำเอง · ยังไม่มี URL ใดที่ใช้งานได้จนกว่าจะทำตามนี้

## ก่อนเริ่ม

- [ ] โค้ดต้องอยู่บน GitHub ก่อน — ตอนนี้ branch `claude/new-project-tasks-9gk8ct` **ยัง push ไม่ได้ (403)** ต้องเชื่อม GitHub ให้ Claude ก่อน หรือ push เองจากไฟล์ bundle:
  ```bash
  git clone hen-ngern-p7.bundle -b claude/new-project-tasks-9gk8ct hen-ngern
  cd hen-ngern
  git remote set-url origin https://github.com/grapethanapat147/hen-ngern.git
  git push -u origin claude/new-project-tasks-9gk8ct
  ```
- [ ] บัญชี Vercel (Hobby ฟรี) ที่ล็อกอินด้วย GitHub เดียวกัน

## ขั้นตอน (ประมาณ 5 นาที)

1. vercel.com → **Add New… → Project** → Import `grapethanapat147/hen-ngern`
2. Framework: **Next.js** (ตรวจเจออัตโนมัติ) · Root directory: `./`
3. Build & install (Vercel อ่าน `bun.lock` เอง ถ้าไม่ใช่ให้ตั้งค่าเอง):
   - Install command: `bun install`
   - Build command: `bun run build`
   - Output: ค่าเริ่มต้นของ Next.js
4. Environment variables: **ไม่ต้องใส่อะไรเลย** (v0 ไม่มี backend, ไม่มี API key)
5. กด **Deploy** จาก branch `claude/new-project-tasks-9gk8ct` (Vercel จะสร้าง Preview URL ให้ ไม่ใช่ Production จนกว่าจะ merge เข้า branch หลัก)
6. แนะนำ: Settings → Deployment Protection → เปิด **Vercel Authentication** ให้ preview เปิดได้เฉพาะคนที่เชิญ ระหว่าง user test

## ตรวจหลัง deploy (Grape ทำ ~5 นาที)

- [ ] เปิด URL บนมือถือจริง → เห็นแบนเนอร์ `ตัวอย่าง ไม่ใช่ยอดจริง` + 4 ตัวเลขโดยไม่ต้องเลื่อน
- [ ] พิมพ์ `ได้ค่างาน 4500` → บันทึก → รีเฟรช → ยอดยังอยู่
- [ ] DevTools → Network: มีแต่ request ไปโดเมน vercel.app ของตัวเอง (A-26)
- [ ] ตั้งค่า → ส่งออก CSV → เปิดใน Excel และ Google Sheets → ภาษาไทยไม่เพี้ยน (A-21 ข้อที่ยังต้องตรวจด้วยคน)
- [ ] ลองบน Safari iPhone: เปิด/ปิด sheet, เลือกวันที่, private mode ต้องเห็นแบนเนอร์ `เบราว์เซอร์นี้ไม่ให้บันทึก…` ถ้าบันทึกไม่ได้

## ข้อควรรู้

- ข้อมูลอยู่ใน localStorage ของแต่ละเบราว์เซอร์ **ผู้ทดสอบแต่ละคนเห็นข้อมูลของตัวเองเท่านั้น** และ URL คนละโดเมนไม่แชร์ข้อมูลกัน (เช่น preview URL ใหม่ของแต่ละ deploy จะเริ่มจากข้อมูลตัวอย่างใหม่)
- ใช้ **URL ของ branch** (ไม่ใช่ URL ของ commit) แจกผู้ทดสอบ เพื่อให้ข้อมูลที่เขาจดไว้ไม่หายเมื่อ deploy ใหม่
- ไม่มี analytics — เก็บผล user test ตาม `06-experiment-plan.md` (แบบฟอร์ม + JSON export ที่ผู้ใช้ยินยอมส่ง)
- เครื่องหมายการค้า/โดเมนของชื่อ "เห็นเงิน" ยังไม่ได้ตรวจ (T2) — อย่าใช้โดเมนจริงหรือเผยแพร่สาธารณะจนกว่าจะตรวจ
