import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourcePath = "C:/Users/may/Downloads/pricestock100176843export1789961369713_0921-11-29-29.xlsx";
const outputPath = "C:/Users/may/programpython/btmusicdrive/outputs/sku-filled-20260921/lazada-price-stock-sku-filled.xlsx";

// Product ID from the Lazada export -> verified NAS-series SKU.
const skuByProductId = new Map([
  ["5587617527", "BT-ST-01-008"], ["5564919407", "BT-IN-01-001"],
  ["5577808767", "BT-ST-01-033"], ["5560326534", "BT-ST-01-006"],
  ["5577911119", "BT-ST-01-042"], ["5564885525", "BT-LT-02-035"],
  ["5577912049", "BT-ST-02-005"], ["5466699516", "BT-ST-02-037"],
  ["5577828706", "BT-LT-01-002"], ["5518876266", "BT-PC-04-032"],
  ["5577700230", "BT-PC-02-045"], ["5577847656", "BT-LK-01-003"],
  ["5466697701", "BT-ST-04-043"], ["5577838668", "BT-PC-02-012"],
  ["5474389170", "BT-ST-02-038"], ["5577850648", "BT-DZ-01-031"],
  ["5518656766", "BT-ST-02-036"], ["5474159686", "BT-ST-04-034"],
  ["5577839621", "BT-LT-02-026"], ["5573140957", "BT-ST-01-004"],
  ["5772621510", "BT-LK-01-013"], ["5801546078", "BT-ST-01-018"],
  ["5814354047", "BT-LT-01-019"], ["5702306781", "BT-ST-01-016"],
  ["5674846820", "BT-ST-02-015"], ["5612409725", "BT-ST-01-009"],
  ["5829187726", "BT-PC-04-040"], ["5614198472", "BT-TA-01-022"],
  ["5643944965", "BT-IN-01-057"], ["5704406357", "BT-IN-01-014"],
  ["5785925369", "BT-ST-01-020"], ["5885331974", "BT-TA-02-039"],
  ["5725372054", "BT-ST-01-017"], ["5636839859", "BT-ST-02-036"],
  ["5664998863", "BT-ST-01-058"], ["5620399900", "BT-TA-02-021"],
  ["5619197141", "BT-ST-01-010"], ["5588756006", "BT-IN-01-007"],
  ["5885357778", "BT-LT-02-026"], ["5793695774", "BT-TA-04-023"],
  ["5893773366", "BT-TA-04-046"], ["16122134169", "BT-DM-M5-041"],
  ["5917531890", "BT-RD-00-061"], ["6078857631", "BT-AC-00-059"],
  ["5893735895", "BT-RD-00-029"], ["16176145446", "BT-LT-04-047"],
  ["5893768294", "BT-ST-01-027"],
]);

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(sourcePath));
const summary = await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 2000 });
console.log(summary.ndjson);

const sheet = workbook.worksheets.getItem("template");
const values = sheet.getRange("A1:L60").values;
let changed = 0;
let unmatched = 0;
for (let row = 4; row < values.length; row++) {
  const productId = String(values[row][0] ?? "").trim();
  if (!productId) continue;
  const sku = skuByProductId.get(productId);
  if (!sku) {
    unmatched++;
    continue;
  }
  if (String(values[row][11] ?? "") !== sku) changed++;
  sheet.getCell(row, 11).values = [[sku]];
}
if (unmatched) throw new Error(`Missing SKU mapping for ${unmatched} Lazada row(s).`);

const verification = sheet.getRange("A5:L52").values;
const invalid = verification.filter(row => row[0] && !/^BT-[A-Z]{2}-[0-9A-Z]{2}-\d{3}$/.test(String(row[11] ?? "")));
if (invalid.length) throw new Error(`Invalid SellerSKU values after update: ${invalid.length}`);

await fs.mkdir(path.dirname(outputPath), { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
const preview = await workbook.render({ sheetName: "template", range: "A1:P15", scale: 1.2, format: "png" });
await fs.writeFile(path.join(path.dirname(outputPath), "template-preview.png"), new Uint8Array(await preview.arrayBuffer()));
console.log(JSON.stringify({ rows: verification.filter(row => row[0]).length, changed, outputPath }));
