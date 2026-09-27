/**
 * สร้าง Google Form 2 ตัวสำหรับ pilot รอบ 2 จาก docs/13-pilot-consent-form.md
 *   createPilotConsentForm  — ใบยินยอมเข้าร่วม pilot (ส่วนที่ 1)
 *   createWeeklyCheckinForm — แบบฟอร์มรายสัปดาห์ (ส่วนที่ 2)
 *
 * วิธีใช้: เหมือน consent-form.gs (ดู docs/forms/README.md) · เติม CONFIG ให้ครบก่อน
 * ไม่เก็บอีเมลผู้ตอบ · ไม่มีช่องอัปโหลดไฟล์ (บังคับล็อกอิน Google) · ไม่ถามยอดเงิน
 */

const CONFIG = {
  organizer: "[ชื่อ Grape หรือชื่อโครงการ]",
  contact: "[อีเมล/LINE สำหรับติดต่อเรื่องนี้]",
  fileChannel: "[ช่องทางส่งไฟล์วิจัย เช่น LINE ส่วนตัว / อีเมล]",
  pilotPeriod: "[2–4] สัปดาห์ ระหว่าง [วันที่] ถึง [วันที่]",
  whoSeesData: "[ระบุชื่อ]",
  aiTools: "[ระบุเครื่องมือ หรือ \"ไม่ใช้\"]",
  compensation: "[ค่าตอบแทนและเงื่อนไข]",
  dataRetention: "ไม่เกิน 12 เดือนหลังจบ pilot", // ค่าเสนอ ปรับได้
  audioRetention: "30 วันหลังสรุปผล", // ค่าเสนอ ปรับได้
  requestDays: "30 วัน", // ค่าเสนอ ปรับได้
};

// Keep in sync with src/domain/research.ts (format henngern-research-v2, option A in docs/13).
const RESEARCH_FILE =
  "ไม่มี: ชื่อรายการ · หมายเหตุ · ยอดเงิน · อัตราแลกเปลี่ยน · ชื่อบัญชี · เลข 4 ตัวท้าย · วันที่จริงและเวลา (ใช้ลำดับวันแทน) · วันเริ่มรอบ · รหัสเดิมของรายการ\n" +
  "มี: ชนิดรายการ · หมวด (หมวดสุขภาพถูกรวมเป็น “อื่น ๆ”) · ลำดับวัน เช่น “วันที่ 3 นับจากวันแรกที่จด” · สกุลเงิน · ประเภทบัญชี · รูปแบบบิลซ้ำ · จดด้วยประโยคหรือกรอกเอง · ช่องที่ต้องแก้จากร่าง (เฉพาะชื่อช่อง) · ลบ/แก้หลังบันทึกไหม";

function checkConfig_() {
  const missing = Object.entries(CONFIG)
    .filter(([, v]) => !String(v).trim() || String(v).includes("["))
    .map(([k]) => k);
  if (missing.length) throw new Error("กรุณาเติมค่าใน CONFIG ก่อนรัน: " + missing.join(", "));
}

function baseSettings_(form, confirmation) {
  return form
    .setCollectEmail(false)
    .setAllowResponseEdits(false)
    .setShowLinkToRespondAgain(false)
    .setConfirmationMessage(confirmation);
}

function participantCode_(form) {
  form
    .addTextItem()
    .setTitle("รหัสผู้เข้าร่วม")
    .setHelpText("เช่น P01 · ใช้แทนชื่อคุณในข้อมูลทั้งหมด")
    .setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextMatchesPattern("^P[0-9]{2}$").setHelpText("ใส่ในรูปแบบ P01–P99").build());
}

function linkSheet_(form, title) {
  const sheet = SpreadsheetApp.create(title);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());
  return sheet;
}

function createPilotConsentForm() {
  checkConfig_();
  const c = CONFIG;
  const YES = "ยินยอม";
  const NO = "ไม่ยินยอม";

  const form = FormApp.create("ใบยินยอมเข้าร่วม Pilot แอป “เห็นเงิน”");
  form.setDescription(
    [
      `ผู้จัด: ${c.organizer} · ติดต่อ: ${c.contact}`,
      "",
      `ลองใช้แอป “เห็นเงิน” จดรายรับรายจ่ายจริงของคุณ ${c.pilotPeriod} ตามปกติ แล้วตอบแบบฟอร์มสั้นๆ สัปดาห์ละครั้ง (ประมาณ 3 นาที)`,
      "แอปยังไม่เสร็จ ถ้าเจอตัวเลขที่ดูไม่ถูก บอกเราได้เลย นั่นคือสิ่งที่เราอยากรู้มากที่สุด",
    ].join("\n"),
  );
  baseSettings_(form, `บันทึกแล้ว ขอบคุณครับ · ถ้าต้องการสำเนา ขอดู/แก้/ลบข้อมูล หรือถอนความยินยอม ติดต่อ ${c.contact}`).setProgressBar(true);

  form
    .addSectionHeaderItem()
    .setTitle("ข้อมูลของคุณอยู่ที่ไหน")
    .setHelpText(
      "• ข้อมูลที่คุณจดในแอปอยู่ในเบราว์เซอร์บนเครื่องของคุณเท่านั้น แอปไม่ส่งข้อมูลขึ้นเซิร์ฟเวอร์ ไม่เชื่อมธนาคาร และไม่มีระบบเก็บสถิติการใช้งาน เราจึงมองไม่เห็นสิ่งที่คุณจด จนกว่าคุณจะเลือกส่งไฟล์ให้เราเอง (ข้อ 2)\n" +
        "• แอปไม่ขอเลขบัญชี เลขบัตรเต็ม รหัสผ่าน หรือ OTP · ช่องบัญชีเก็บได้แค่ 4 ตัวท้าย และไม่บังคับใส่",
    );
  form
    .addSectionHeaderItem()
    .setTitle("ความเสี่ยงที่ควรรู้")
    .setHelpText(
      "• ถ้าล้างข้อมูลเบราว์เซอร์ หรือใช้โหมดไม่ระบุตัวตน ข้อมูลที่จดจะหาย · แนะนำให้กด ตั้งค่า → ส่งออก JSON เก็บไว้ในเครื่องเป็นระยะ\n" +
        "• ไฟล์ “ส่งออก JSON” มีข้อมูลทั้งหมดของคุณ รวมยอดเงินและชื่อรายการ — ห้ามส่งไฟล์นี้ให้เรา · ไฟล์ที่ส่งให้เราได้มีแค่ไฟล์จากปุ่ม “ส่งออกสำหรับงานวิจัย” (ชื่อไฟล์ขึ้นต้นด้วย henngern-research-)\n" +
        "• ใครที่ใช้เครื่อง/เบราว์เซอร์เดียวกับคุณจะเปิดดูข้อมูลในแอปได้ เพราะแอปยังไม่มีรหัสล็อก\n" +
        "• ถ้าลิงก์แอปเปลี่ยน ข้อมูลเดิมจะไม่ตามไป · เราจะใช้ลิงก์เดียวตลอด pilot และจะแจ้งล่วงหน้าถ้าจำเป็นต้องเปลี่ยน",
    );
  form.addSectionHeaderItem().setTitle("ในไฟล์ “ส่งออกสำหรับงานวิจัย” มีอะไร (ข้อ 2)").setHelpText(RESEARCH_FILE + "\nคุณกดดูตัวอย่างข้อมูลในไฟล์ได้ก่อนดาวน์โหลดทุกครั้ง");
  form
    .addSectionHeaderItem()
    .setTitle("เราเก็บไว้นานแค่ไหน ใครเห็น และสิทธิ์ของคุณ")
    .setHelpText(
      `• คำตอบแบบฟอร์มและไฟล์วิจัย (ใช้รหัสแทนชื่อ): เก็บ${c.dataRetention} แล้วลบ\n` +
        `• เสียงสัมภาษณ์: ลบภายใน ${c.audioRetention}\n` +
        "• ชื่อและช่องทางติดต่อ: เก็บแยกจากข้อมูลข้างบน และลบหลังจบ pilot เว้นแต่คุณยินยอมข้อ 6\n" +
        `• ผู้ที่เห็นข้อมูล: ${c.whoSeesData} เท่านั้น ไม่ขาย ไม่ส่งต่อ · เครื่องมือ AI ช่วยวิเคราะห์ (เฉพาะข้อมูลที่ไม่มีชื่อ): ${c.aiTools}\n` +
        "• หยุดเมื่อไรก็ได้ ไม่ต้องบอกเหตุผล · วิธีหยุด: แจ้งเรา แล้วกด ตั้งค่า → ล้างข้อมูลในเครื่อง ถ้าต้องการลบข้อมูลในแอปด้วย\n" +
        `• ขอดู ขอแก้ หรือขอให้ลบข้อมูลที่ส่งให้เราแล้วได้ทุกเมื่อ ติดต่อ ${c.contact} เราจะดำเนินการภายใน ${c.requestDays}\n` +
        "• ถอนความยินยอมข้อ 2–6 ได้ภายหลัง ข้อมูลที่เกี่ยวข้องจะถูกลบ (ยกเว้นส่วนที่รวมเป็นผลสรุปแบบไม่ระบุตัวตนไปแล้ว)\n" +
        "• ข้อมูลส่วนบุคคลของคุณได้รับความคุ้มครองตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562\n" +
        `• ค่าตอบแทน: ${c.compensation}`,
    );

  participantCode_(form);
  const q1 = form
    .addMultipleChoiceItem()
    .setTitle("ข้อ 1 · เข้าร่วม pilot และตอบแบบฟอร์มรายสัปดาห์ (ใช้รหัสแทนชื่อ)")
    .setHelpText("ข้อนี้จำเป็นสำหรับการเข้าร่วม")
    .setRequired(true);

  form.addPageBreakItem().setTitle("การยินยอมเพิ่มเติม (ไม่บังคับ)").setHelpText("เลือก “ไม่ยินยอม” ได้ทุกข้อ ไม่มีผลต่อการเข้าร่วม");
  [
    "ข้อ 2 · ส่งไฟล์ “ส่งออกสำหรับงานวิจัย” ให้ผู้จัด (สัปดาห์ละครั้ง หรือตอนจบ)",
    "ข้อ 3 · สัมภาษณ์ท้าย pilot 20–30 นาที",
    "ข้อ 4 · อัดเสียงระหว่างสัมภาษณ์",
    "ข้อ 5 · ยกคำพูดของฉันแบบไม่ระบุชื่อ ในรายงานหรือผลงาน (portfolio) ของผู้จัด",
    "ข้อ 6 · ติดต่อฉันได้ถ้ามีการทดสอบรอบถัดไป (เก็บชื่อและช่องทางติดต่อไว้หลังจบ pilot)",
  ].forEach((title) => form.addMultipleChoiceItem().setTitle(title).setChoiceValues([YES, NO]).setRequired(true));
  form
    .addCheckboxItem()
    .setTitle("ยืนยัน")
    .setChoiceValues(["ฉันได้อ่านและเข้าใจเนื้อหาข้างต้น รวมถึงเรื่องห้ามส่งไฟล์ “ส่งออก JSON” และได้ถามคำถามที่สงสัยแล้ว"])
    .setRequired(true);
  form.addTextItem().setTitle("ชื่อ-นามสกุล (ใช้แทนลายเซ็น)").setHelpText("เก็บแยกจากข้อมูล pilot ใช้เป็นหลักฐานการยินยอมเท่านั้น").setRequired(true);
  form.addTextItem().setTitle("ช่องทางติดต่อ (LINE ID / อีเมล)").setHelpText("ใช้ส่งลิงก์แบบฟอร์มรายสัปดาห์").setRequired(true);

  const declined = form.addPageBreakItem().setTitle("ขอบคุณที่สละเวลาอ่าน").setHelpText("คุณเลือกไม่เข้าร่วม เราจะไม่เก็บข้อมูลของคุณ กด “ส่ง” เพื่อจบ");
  declined.setGoToPage(FormApp.PageNavigationType.SUBMIT);
  q1.setChoices([q1.createChoice(YES, FormApp.PageNavigationType.CONTINUE), q1.createChoice(NO, declined)]);

  const sheet = linkSheet_(form, "ใบยินยอม pilot เห็นเงิน (คำตอบ)");
  Logger.log("ใบยินยอม — ลิงก์ส่งผู้เข้าร่วม: " + form.getPublishedUrl());
  Logger.log("ใบยินยอม — ลิงก์แก้ไข: " + form.getEditUrl());
  Logger.log("ใบยินยอม — Sheet คำตอบ: " + sheet.getUrl());
}

function createWeeklyCheckinForm() {
  checkConfig_();
  const c = CONFIG;
  const form = FormApp.create("เห็นเงิน · แบบฟอร์มรายสัปดาห์ (3 นาที)");
  form.setDescription("ขอบคุณที่ช่วยทดลองใช้ครับ · ไม่ต้องบอกยอดเงินจริงในแบบฟอร์มนี้ · ถ้ามีเรื่องด่วน ติดต่อ " + c.contact);
  baseSettings_(form, "บันทึกแล้ว ขอบคุณครับ · ถ้ายินยอมส่งไฟล์วิจัย ส่งไฟล์ที่ขึ้นต้นด้วย henngern-research- ทาง " + c.fileChannel + " (ห้ามส่งไฟล์ henngern-backup-)");

  participantCode_(form);
  form.addMultipleChoiceItem().setTitle("W2 · สัปดาห์ที่").setChoiceValues(["1", "2", "3", "4"]).setRequired(true);
  form.addScaleItem().setTitle("W3 · สัปดาห์นี้เปิดแอปจดกี่วัน").setBounds(0, 7).setRequired(true);
  form.addMultipleChoiceItem().setTitle("W4 · สัปดาห์นี้เจอตัวเลขที่ดูผิดไหม").setChoiceValues(["ไม่เจอ", "เจอ แก้ได้เอง", "เจอ แก้ไม่ได้"]).setRequired(true);
  form.addParagraphTextItem().setTitle("W5 · ถ้าเจอ เล่าหน่อยว่าเกิดอะไรขึ้น").setHelpText("ไม่ต้องบอกยอดจริง เช่น “จดโอนจ่ายบัตรแล้วจ่ายจริงเพิ่มขึ้น”");
  form
    .addMultipleChoiceItem()
    .setTitle("W6 · ตอนพิมพ์เป็นประโยค ต้องแก้ร่างบ่อยแค่ไหน")
    .setChoiceValues(["แทบไม่ต้องแก้", "บางครั้ง", "บ่อย", "ไม่ได้ใช้การพิมพ์ประโยค"])
    .setRequired(true);
  form.addParagraphTextItem().setTitle("W7 · อะไรที่ทำให้งง ช้า หรือหงุดหงิดที่สุดสัปดาห์นี้");
  form.addMultipleChoiceItem().setTitle("W8 · สัปดาห์หน้าจะใช้ต่อไหม").setChoiceValues(["ใช้ต่อ", "ไม่แน่ใจ", "จะเลิก"]).setRequired(true);
  form.addParagraphTextItem().setTitle("W9 · เพราะอะไร");
  form
    .addMultipleChoiceItem()
    .setTitle("W10 · (ถ้ายินยอมส่งไฟล์วิจัย) ส่งไฟล์สัปดาห์นี้แล้วหรือยัง")
    .setHelpText("ส่งทาง " + c.fileChannel + " · ไฟล์ต้องขึ้นต้นด้วย henngern-research-")
    .setChoiceValues(["ส่งแล้ว", "จะส่งภายหลัง", "ไม่ส่งสัปดาห์นี้", "ไม่ได้ยินยอมส่งไฟล์"]);

  const sheet = linkSheet_(form, "แบบฟอร์มรายสัปดาห์ เห็นเงิน (คำตอบ)");
  Logger.log("รายสัปดาห์ — ลิงก์ส่งผู้เข้าร่วม: " + form.getPublishedUrl());
  Logger.log("รายสัปดาห์ — ลิงก์แก้ไข: " + form.getEditUrl());
  Logger.log("รายสัปดาห์ — Sheet คำตอบ: " + sheet.getUrl());
}
