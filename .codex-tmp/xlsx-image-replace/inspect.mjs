import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = process.argv[2] ?? "C:/Users/may/Downloads/basic100176843export1788963592559_0909-22-19-52.xlsx";
const previewDir = process.argv[3] ?? "C:/Users/may/programpython/btmusicdrive/.codex-tmp/xlsx-image-replace/previews-before";

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const summary = await workbook.inspect({
  kind: "workbook,sheet,table,drawing",
  maxChars: 12000,
  tableMaxRows: 8,
  tableMaxCols: 12,
  tableMaxCellChars: 100,
});
console.log(summary.ndjson);

await fs.mkdir(previewDir, { recursive: true });
for (let i = 0; i < workbook.worksheets.items.length; i += 1) {
  const sheet = workbook.worksheets.getItemAt(i);
  const images = sheet.images.items.map((item) => ({
    id: item.id,
    name: item.name,
    anchor: item.anchor,
  }));
  console.log(JSON.stringify({ sheet: sheet.name, images }, null, 2));
  const preview = await workbook.render({ sheetName: sheet.name, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${previewDir}/${String(i + 1).padStart(2, "0")}-${sheet.name.replace(/[\\/:*?\"<>|]/g, "_")}.png`, new Uint8Array(await preview.arrayBuffer()));
}
