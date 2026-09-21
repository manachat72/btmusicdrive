import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = process.argv[2];
const outputPath = process.argv[3];
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const sheet = workbook.worksheets.getItem("template");

const beforeLeft = JSON.stringify(sheet.getRange("A5:E51").values);
const beforeRight = JSON.stringify(sheet.getRange("N5:W51").values);
const row = sheet.getRange("F33:M33").values[0];
const replacement = row.map((value) => (
  typeof value === "string"
    ? value.replace("/products/19/", "/products/19-cd/")
    : value
));
sheet.getRange("F33:M33").values = [replacement];
workbook.recalculate();

if (beforeLeft !== JSON.stringify(sheet.getRange("A5:E51").values)) {
  throw new Error("ข้อมูลด้านซ้ายของคอลัมน์รูปเปลี่ยนโดยไม่ตั้งใจ");
}
if (beforeRight !== JSON.stringify(sheet.getRange("N5:W51").values)) {
  throw new Error("ข้อมูลด้านขวาของคอลัมน์รูปเปลี่ยนโดยไม่ตั้งใจ");
}
if (!replacement.every((value) => !value || String(value).includes("/products/19-cd/"))) {
  throw new Error("สร้างลิงก์แยกสำหรับแถว CD ไม่ครบ");
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

const reopened = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
const verified = reopened.worksheets.getItem("template").getRange("F33:M33").values[0];
if (JSON.stringify(verified) !== JSON.stringify(replacement)) {
  throw new Error("ค่ารูปหลังบันทึกไม่ตรงกับที่แก้");
}

console.log(JSON.stringify({ outputPath, row: 33, productId: "5636839859", urls: verified }, null, 2));
