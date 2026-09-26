/**
 * สร้าง Google Form "แบบคัดกรองผู้ทดสอบ เห็นเงิน" จาก docs/12-recruiting-kit.md §3
 *
 * วิธีใช้: เหมือน consent-form.gs (ดู docs/forms/README.md)
 *   1. https://script.google.com → New project → วางไฟล์นี้
 *   2. เติม CONFIG ให้ครบ (script จะไม่ยอมรันถ้ายังมี [ … ] ค้าง)
 *   3. Run createScreenerForm → ดูลิงก์ใน Execution log
 *
 * ไม่เก็บอีเมลผู้ตอบ · ไม่ถามรายได้ ยอดเงิน หรือธนาคาร
 */

const CONFIG = {
  organizer: "[ชื่อ Grape หรือชื่อโครงการ]",
  contact: "[อีเมล/LINE สำหรับติดต่อเรื่องนี้]",
  compensation: "[ระบุ เช่น บัตรกำนัล … บาท / ไม่มีค่าตอบแทน]",
  testDates: "[ช่วงวันที่ทดสอบ เช่น 6–9 ต.ค.]",
  replyBy: "[วันที่จะติดต่อกลับ]",
  // ช่วงเวลาที่เปิดให้เลือก (แก้ได้ตามจริง)
  slots: ["[วัน เวลา 1]", "[วัน เวลา 2]", "[วัน เวลา 3]"],
};

function checkConfig_() {
  const bad = (v) => !String(v).trim() || String(v).includes("[");
  const missing = Object.entries(CONFIG)
    .filter(([, v]) => (Array.isArray(v) ? v.length === 0 || v.some(bad) : bad(v)))
    .map(([k]) => k);
  if (missing.length) throw new Error("กรุณาเติมค่าใน CONFIG ก่อนรัน: " + missing.join(", "));
}

function createScreenerForm() {
  checkConfig_();
  const c = CONFIG;
  const form = FormApp.create("สมัครลองใช้แอปจดเงิน “เห็นเงิน” (2 นาที)");
  form
    .setDescription(
      [
        `ผู้จัด: ${c.organizer} · ติดต่อ: ${c.contact}`,
        "",
        "เรากำลังหาคนมาลองแอปจดรายรับรายจ่ายภาษาไทยที่ยังไม่เสร็จ ใช้เวลาประมาณ 50 นาที",
        `ช่วงวันที่: ${c.testDates} · ค่าตอบแทน: ${c.compensation}`,
        "ไม่ต้องใช้ข้อมูลการเงินจริง และแบบฟอร์มนี้ไม่ถามรายได้ ยอดเงิน หรือธนาคารของคุณ",
        "",
        `เราจะติดต่อกลับเฉพาะคนที่ได้รับเลือกภายใน ${c.replyBy} · ข้อมูลในแบบฟอร์มนี้ใช้เพื่อนัดหมายเท่านั้น และจะลบข้อมูลของคนที่ไม่ได้รับเลือกหลังจบรอบนี้`,
      ].join("\n"),
    )
    .setCollectEmail(false)
    .setAllowResponseEdits(false)
    .setShowLinkToRespondAgain(false)
    .setConfirmationMessage(`ขอบคุณที่สมัครครับ เราจะติดต่อกลับเฉพาะคนที่ได้รับเลือกภายใน ${c.replyBy} · ถ้าต้องการให้ลบข้อมูล ติดต่อ ${c.contact}`);

  const choice = (title, options, required = true) =>
    form.addMultipleChoiceItem().setTitle(title).setChoiceValues(options).setRequired(required);
  const checks = (title, options, required = true) =>
    form.addCheckboxItem().setTitle(title).setChoiceValues(options).setRequired(required);

  choice("S1 · อายุ", ["ต่ำกว่า 20", "20–21", "22–30", "31–40", "มากกว่า 40"]);
  choice("S2 · ตอนนี้ทำงานแบบไหน", ["พนักงานประจำ", "ฟรีแลนซ์/รับงานอิสระ", "ธุรกิจส่วนตัว", "นักศึกษา", "อื่นๆ"]);
  choice("S3 · 3 เดือนที่ผ่านมา มีรายได้นอกเหนืองานหลักไหม", ["มี", "ไม่มี"]);
  choice("S4 · มีบริการที่ตัดเงินอัตโนมัติทุกเดือน/ทุกปีกี่อย่าง", ["ไม่มี", "1–2", "3–5", "6 ขึ้นไป", "ไม่แน่ใจ"]).setHelpText(
    "เช่น สตรีมมิ่ง เพลง คลาวด์ แอปทำงาน ฟิตเนส",
  );
  choice("S5 · มีบริการไหนตัดเงินเป็นดอลลาร์ไหม", ["มี", "ไม่มี", "ไม่แน่ใจ"]);
  checks("S6 · ตอนนี้ติดตามรายรับรายจ่ายยังไง (เลือกได้หลายข้อ)", [
    "แอปจดเงิน",
    "Excel/Google Sheets",
    "จดในโน้ต/สมุด",
    "ดูในแอปธนาคาร",
    "ไม่ได้ติดตาม",
  ]);
  choice("S7 · มือถือที่ใช้หลัก", ["iPhone", "Android"]);
  choice("S8 · ทำงานด้านออกแบบหรือพัฒนาแอปการเงินไหม", ["ใช่", "ไม่ใช่"]);
  choice("S9 · รู้จักผู้จัดทดสอบแบบไหน", ["ไม่รู้จัก", "รู้จักผ่านเพื่อน", "เพื่อน/เพื่อนร่วมงาน", "ครอบครัว"]);
  checks("S10 · ช่วงเวลาที่สะดวก (เลือกได้หลายข้อ)", c.slots);
  choice("S11 · แบบที่สะดวก", ["เจอตัว", "ออนไลน์", "ได้ทั้งสองแบบ"]);
  form.addTextItem().setTitle("S12 · ชื่อเล่น").setRequired(true);
  form.addTextItem().setTitle("S13 · ช่องทางติดต่อ (LINE ID / อีเมล / เบอร์โทร)").setRequired(true);

  const sheet = SpreadsheetApp.create("สมัครทดสอบ เห็นเงิน (คำตอบ)");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  Logger.log("ลิงก์แบบคัดกรอง: " + form.getPublishedUrl());
  Logger.log("ลิงก์แก้ไข Form: " + form.getEditUrl());
  Logger.log("Sheet คำตอบ: " + sheet.getUrl());
}
