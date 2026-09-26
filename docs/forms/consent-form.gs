/**
 * สร้าง Google Form "ใบขออนุญาตเข้าร่วมทดสอบแอป เห็นเงิน" จาก docs/11-consent-form.md
 *
 * วิธีใช้ (ดู docs/forms/README.md):
 *   1. เปิด https://script.google.com → New project → วางไฟล์นี้ทั้งไฟล์
 *   2. แก้ค่าใน CONFIG ด้านล่างให้ครบ (script จะไม่ยอมรันถ้ายังมี [ … ] ค้างอยู่)
 *   3. เลือกฟังก์ชัน createConsentForm → Run → อนุญาตสิทธิ์ Forms/Sheets/Drive ของบัญชีคุณเอง
 *   4. ดูลิงก์ Form / ลิงก์แก้ไข / Sheet คำตอบ ใน Execution log
 *
 * Script สร้างไฟล์ใหม่ใน Drive ของคุณเท่านั้น ไม่ส่งข้อมูลไปที่อื่น และไม่เก็บอีเมลผู้ตอบ
 */

const CONFIG = {
  organizer: "[ชื่อ Grape หรือชื่อโครงการ]",
  contact: "[อีเมล/LINE สำหรับติดต่อเรื่องนี้]",
  whoSeesData: "[Grape และผู้ช่วยจดบันทึก ถ้ามี — ระบุชื่อ]",
  aiTools: "[ระบุเครื่องมือ หรือเขียนว่า \"ไม่ใช้\"]",
  videoRetention: "30 วันหลังสรุปผลการทดสอบ", // ค่าเสนอ ปรับได้
  notesRetention: "จนจบโครงการ หรือไม่เกิน 12 เดือน", // ค่าเสนอ ปรับได้
  sentenceRetention: "ไม่เกิน 12 เดือน", // ค่าเสนอ ปรับได้
  requestDays: "30 วัน", // ค่าเสนอ ปรับได้
  compensation: "[ระบุ เช่น บัตรกำนัล … บาท / ไม่มีค่าตอบแทน]",
};

function checkConfig_() {
  const missing = Object.entries(CONFIG)
    .filter(([, v]) => !String(v).trim() || String(v).includes("["))
    .map(([k]) => k);
  if (missing.length) {
    throw new Error("กรุณาเติมค่าใน CONFIG ก่อนรัน: " + missing.join(", "));
  }
}

function createConsentForm() {
  checkConfig_();
  const c = CONFIG;
  const ALLOW = "อนุญาต";
  const DENY = "ไม่อนุญาต";

  const form = FormApp.create("ใบขออนุญาตเข้าร่วมทดสอบแอป “เห็นเงิน”");
  form
    .setDescription(
      [
        `ผู้จัดทดสอบ: ${c.organizer} · ติดต่อ: ${c.contact}`,
        "",
        "เรากำลังพัฒนาแอปจดรายรับรายจ่ายภาษาไทยชื่อ “เห็นเงิน” ซึ่งยังไม่เสร็จ และอยากดูว่าคนใช้แอปนี้ได้เองหรือไม่ ตรงไหนทำให้งง",
        "session ใช้เวลาประมาณ 50 นาที มีการคุยเรื่องวิธีจัดการเงินของคุณในตอนนี้ (ไม่ถามยอดเงินหรือเลขบัญชี) และให้ลองใช้แอปทำงานสั้นๆ 5 ข้อ",
        "",
        "เราทดสอบแอป ไม่ได้ทดสอบคุณ ไม่มีคำตอบผิด",
      ].join("\n"),
    )
    .setCollectEmail(false)
    .setAllowResponseEdits(false)
    .setShowLinkToRespondAgain(false)
    .setProgressBar(true)
    .setConfirmationMessage(`บันทึกคำตอบแล้ว ขอบคุณครับ · ถ้าต้องการสำเนา ขอดู/แก้/ลบข้อมูล หรือเปลี่ยนใจ ติดต่อ ${c.contact}`);

  // --- หน้า 1: อ่านก่อน + ข้อ 1 (จำเป็น) ---------------------------------------
  form
    .addSectionHeaderItem()
    .setTitle("สิ่งที่เราขอให้คุณไม่ทำ")
    .setHelpText(
      "• ไม่ต้องใส่ข้อมูลการเงินจริงในแอประหว่างทดสอบ ใช้ยอดสมมติได้ทั้งหมด\n" +
        "• ไม่ต้องบอกเลขบัญชี เลขบัตร รหัสผ่าน หรือ OTP (แอปนี้ไม่ขอสิ่งเหล่านี้เลย)",
    );
  form
    .addSectionHeaderItem()
    .setTitle("ข้อมูลที่เราเก็บ")
    .setHelpText(
      "ทุกคน: คำตอบในการสัมภาษณ์ (จดเป็นข้อความ) และสิ่งที่สังเกตได้ระหว่างใช้แอป เวลาที่ใช้ จุดที่ติด — ใช้ปรับแอป\n" +
        "เฉพาะเมื่ออนุญาตข้อ 2: วิดีโอหน้าจอ / เสียง — ย้อนดูจุดที่งง\n" +
        "เฉพาะเมื่ออนุญาตข้อ 3: ประโยคที่คุณพิมพ์ (เช่น “กาแฟ 65”) — ทดสอบความแม่นยำของระบบแปลงประโยค\n" +
        "เฉพาะเมื่ออนุญาตข้อ 4: คำพูดของคุณที่ไม่ระบุตัวตน — อ้างในรายงานหรือผลงาน (portfolio) ของผู้จัดทดสอบ\n\n" +
        "เราไม่เก็บ: ชื่อจริงของคุณในบันทึกการทดสอบ, ยอดเงินจริง, ชื่อธนาคาร/บัญชีจริง, ข้อมูลจากโทรศัพท์ของคุณ\n" +
        "แอปเก็บข้อมูลไว้ในเบราว์เซอร์ของเครื่องที่ใช้ทดสอบเท่านั้น ไม่ส่งขึ้นเซิร์ฟเวอร์ และเราจะล้างข้อมูลในแอปหลังจบ session",
    );
  form
    .addSectionHeaderItem()
    .setTitle("เราเก็บไว้นานแค่ไหน และใครเห็น")
    .setHelpText(
      `• วิดีโอ/เสียง: ลบภายใน ${c.videoRetention}\n` +
        `• บันทึกข้อความ (ใช้รหัสแทนชื่อ): เก็บไว้${c.notesRetention}\n` +
        `• ประโยคที่พิมพ์: ลบชื่อคน เบอร์โทร และเลขบัญชีออก (ถ้ามี) ก่อนเก็บ แล้วเก็บไว้ใช้ทดสอบระบบ ${c.sentenceRetention}\n` +
        `• ผู้ที่เห็นข้อมูล: ${c.whoSeesData} เท่านั้น ไม่ขายหรือส่งต่อให้บุคคลอื่น\n` +
        `• การใช้เครื่องมือ AI ช่วยสรุปบันทึก (เฉพาะบันทึกที่ไม่มีชื่อ): ${c.aiTools}`,
    );
  form
    .addSectionHeaderItem()
    .setTitle("สิทธิ์ของคุณ และค่าตอบแทน")
    .setHelpText(
      "• ไม่ร่วมก็ได้ และหยุดเมื่อไรก็ได้ โดยไม่ต้องบอกเหตุผล ไม่มีผลเสียใดๆ\n" +
        `• ขอดู ขอแก้ หรือขอให้ลบข้อมูลของคุณได้ ทั้งระหว่างและหลังการทดสอบ ติดต่อ ${c.contact} เราจะดำเนินการภายใน ${c.requestDays}\n` +
        "• ถอนการอนุญาตข้อ 2–4 ได้ภายหลัง ข้อมูลที่เกี่ยวข้องจะถูกลบ (ยกเว้นส่วนที่รวมเป็นผลสรุปแบบไม่ระบุตัวตนไปแล้ว)\n" +
        "• ข้อมูลส่วนบุคคลของคุณได้รับความคุ้มครองตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562\n" +
        `• ค่าตอบแทน: ${c.compensation} · ได้รับแม้จะหยุดกลางคัน`,
    );

  form
    .addTextItem()
    .setTitle("รหัสผู้ทดสอบ")
    .setHelpText("ผู้จัดทดสอบจะบอกรหัสให้ เช่น P01 · เราใช้รหัสนี้แทนชื่อคุณในบันทึกทั้งหมด")
    .setRequired(true)
    .setValidation(
      FormApp.createTextValidation().requireTextMatchesPattern("^P[0-9]{2}$").setHelpText("ใส่ในรูปแบบ P01–P99").build(),
    );

  const q1 = form
    .addMultipleChoiceItem()
    .setTitle("ข้อ 1 · เข้าร่วมทดสอบ และให้จดบันทึกคำตอบและสิ่งที่สังเกตได้ (ใช้รหัสแทนชื่อ)")
    .setHelpText("ข้อนี้จำเป็นสำหรับการเข้าร่วม")
    .setRequired(true);

  // --- หน้า 2: ข้อ 2–4 (ไม่บังคับ) + ยืนยัน ---------------------------------------
  form.addPageBreakItem().setTitle("การอนุญาตเพิ่มเติม (ไม่บังคับ)").setHelpText("เลือก “ไม่อนุญาต” ได้ทุกข้อ ไม่มีผลต่อการเข้าร่วม");

  const optional = [
    "ข้อ 2 · อัดวิดีโอหน้าจอและเสียงระหว่าง session",
    "ข้อ 3 · เก็บประโยคที่ฉันพิมพ์ (หลังลบข้อมูลที่ระบุตัวตน) ไว้ทดสอบระบบแปลงประโยค",
    "ข้อ 4 · ยกคำพูดของฉันแบบไม่ระบุชื่อ ในรายงานหรือผลงาน (portfolio) ของผู้จัดทดสอบ",
  ];
  optional.forEach((title) => {
    form.addMultipleChoiceItem().setTitle(title).setChoiceValues([ALLOW, DENY]).setRequired(true);
  });

  form
    .addCheckboxItem()
    .setTitle("ยืนยัน")
    .setChoiceValues(["ฉันได้อ่านและเข้าใจเนื้อหาข้างต้น และได้ถามคำถามที่สงสัยแล้ว"])
    .setRequired(true);

  form
    .addTextItem()
    .setTitle("ชื่อ-นามสกุล (ใช้แทนลายเซ็น)")
    .setHelpText("เก็บแยกจากบันทึกการทดสอบ ใช้เป็นหลักฐานการยินยอมเท่านั้น")
    .setRequired(true);

  // --- หน้า 3: ไม่เข้าร่วม -----------------------------------------------------------
  const declined = form
    .addPageBreakItem()
    .setTitle("ขอบคุณที่สละเวลาอ่าน")
    .setHelpText("คุณเลือกไม่เข้าร่วม เราจะไม่เก็บข้อมูลการทดสอบของคุณ กด “ส่ง” เพื่อจบ");
  // Finishing page 2 submits the form instead of continuing to the "declined" page.
  declined.setGoToPage(FormApp.PageNavigationType.SUBMIT);

  q1.setChoices([q1.createChoice(ALLOW, FormApp.PageNavigationType.CONTINUE), q1.createChoice(DENY, declined)]);

  // Responses go to a new Sheet in your own Drive.
  const sheet = SpreadsheetApp.create("ใบขออนุญาต เห็นเงิน (คำตอบ)");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  Logger.log("ลิงก์ส่งให้ผู้ทดสอบ: " + form.getPublishedUrl());
  Logger.log("ลิงก์แก้ไข Form: " + form.getEditUrl());
  Logger.log("Sheet คำตอบ: " + sheet.getUrl());
}
