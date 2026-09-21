import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = process.argv[2];
const range = process.argv[3] ?? "A1:W60";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const sheet = workbook.worksheets.getItem("template");
const startRow = Number(range.match(/\d+/)?.[0] ?? 1);
const rows = sheet.getRange(range).values;

console.log(JSON.stringify(rows.map((row, index) => ({
  row: startRow + index,
  id: row[0],
  name: row[2],
  image1: row[5],
  image2: row[6],
  image3: row[7],
  image4: row[8],
  image5: row[9],
  image6: row[10],
  image7: row[11],
  image8: row[12],
})), null, 2));
