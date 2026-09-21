import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const actualInputPath = "C:/Users/may/Downloads/basic100176843export1788963592559_0909-22-19-52_เปลี่ยนรูปแล้ว.xlsx";
const catalogPath = "C:/Users/may/programpython/btmusicdrive/marketplace-images/catalog.json";
const outputDir = "C:/Users/may/Downloads";
const outputPath = `${outputDir}/basic100176843export1788963592559_0909-22-19-52_แก้รูปแยกสินค้า.xlsx`;
const previewPath = "C:/Users/may/programpython/btmusicdrive/.codex-tmp/xlsx-image-replace/preview-corrected.png";

// จับคู่สินค้าในแถว 5-51 กับเลขโฟลเดอร์บน NAS ตามชื่อสินค้า
const rowCodes = [
  "01", "09", "10", "04", "18", "14", "11", "13", "02", "05",
  "12", "16", "08", "15", "03", "21", "23", "22", "19", "06",
  "31", "29", "35", "36", "24", "33", "34", "37", "19", "45",
  "38", "42", "25", "17", "28", "30", "27", "07", "43", "44",
  "55", "48", "47", "53", "20", "46", "54",
];

const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8")).products;
const byCode = new Map(catalog.map((product) => [product.code, product]));

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(actualInputPath));
const sheet = workbook.worksheets.getItem("template");
const used = sheet.getUsedRange();
const lastRow = used.rowCount;
const firstProductRow = 5;
const productRowCount = lastRow - firstProductRow + 1;

const beforeLeft = JSON.stringify(sheet.getRange(`A${firstProductRow}:E${lastRow}`).values);
const beforeRight = JSON.stringify(sheet.getRange(`N${firstProductRow}:W${lastRow}`).values);
if (rowCodes.length !== productRowCount) throw new Error(`จำนวนรหัสโฟลเดอร์ ${rowCodes.length} ไม่ตรงกับจำนวนสินค้า ${productRowCount}`);
const replacementRows = rowCodes.map((code) => {
  const product = byCode.get(code);
  if (!product) throw new Error(`ไม่พบสินค้าโฟลเดอร์ ${code} ใน catalog.json`);
  return Array.from({ length: 8 }, (_, i) => product.images[i] ?? null);
});
sheet.getRange(`F${firstProductRow}:M${lastRow}`).values = replacementRows;

workbook.recalculate();

if (beforeLeft !== JSON.stringify(sheet.getRange(`A${firstProductRow}:E${lastRow}`).values)) {
  throw new Error("ข้อมูลนอกคอลัมน์รูปด้านซ้ายเปลี่ยนโดยไม่ตั้งใจ");
}
if (beforeRight !== JSON.stringify(sheet.getRange(`N${firstProductRow}:W${lastRow}`).values)) {
  throw new Error("ข้อมูลนอกคอลัมน์รูปด้านขวาเปลี่ยนโดยไม่ตั้งใจ");
}

const firstRows = await workbook.inspect({
  kind: "table",
  sheetId: "template",
  range: `A1:M8`,
  include: "values,formulas",
  tableMaxRows: 8,
  tableMaxCols: 13,
  maxChars: 8000,
});
console.log(firstRows.ndjson);
const lastRows = await workbook.inspect({
  kind: "table",
  sheetId: "template",
  range: `A${Math.max(firstProductRow, lastRow - 2)}:M${lastRow}`,
  include: "values,formulas",
  tableMaxRows: 3,
  tableMaxCols: 13,
  maxChars: 5000,
});
console.log(lastRows.ndjson);
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

await fs.mkdir(outputDir, { recursive: true });
const preview = await workbook.render({ sheetName: "template", autoCrop: "all", scale: 1, format: "png" });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

const reopened = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
const reopenedSheet = reopened.worksheets.getItem("template");
const reopenedRows = reopenedSheet.getRange(`F${firstProductRow}:M${lastRow}`).values;
if (JSON.stringify(reopenedRows) !== JSON.stringify(replacementRows)) {
  throw new Error("ค่ารูปหลังบันทึกไม่ตรงกับค่าที่ตั้งไว้");
}

console.log(JSON.stringify({
  outputPath,
  previewPath,
  productRowsUpdated: productRowCount,
  folderCodesUsed: rowCodes,
  uniqueFoldersUsed: [...new Set(rowCodes)].length,
}, null, 2));
