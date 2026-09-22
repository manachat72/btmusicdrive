import fs from 'node:fs/promises';
import path from 'node:path';
import XLSX from 'xlsx';

const root = 'C:/Users/may/programpython/btmusicdrive';
const templatePath = (await fs.readdir('C:/Users/may/Downloads'))
  .filter((name) => name.includes('Bundle_SKU_TH.xlsx'))
  .map((name) => path.join('C:/Users/may/Downloads', name))
  .at(0);
if (!templatePath) throw new Error('BigSeller create-Bundle template was not found');

const targetSkus = new Set(['BT-TA-04-023', 'BT-LT-04-025', 'BT-LT-04-047']);
const source = JSON.parse(await fs.readFile(path.join(root, 'products.json'), 'utf8'));
const products = (Array.isArray(source) ? source : source.products)
  .filter((product) => targetSkus.has(product.sku))
  .map((product) => ({ sku: product.sku, name: product.name, rawSku: 'RAW-4GB' }));
if (products.length !== targetSkus.size) throw new Error('Could not locate every missing product');

const workbook = XLSX.readFile(templatePath, { cellStyles: true, cellNF: true, cellFormula: true });
const sheet = workbook.Sheets.Sheet1;
for (let row = 2; row <= 5001; row += 1) {
  for (let column = 0; column < 74; column += 1) delete sheet[XLSX.utils.encode_cell({ r: row - 1, c: column })];
}
for (const [index, product] of products.entries()) {
  const row = index + 1;
  sheet[XLSX.utils.encode_cell({ r: row, c: 0 })] = { t: 's', v: product.sku };
  sheet[XLSX.utils.encode_cell({ r: row, c: 1 })] = { t: 's', v: product.name };
  sheet[XLSX.utils.encode_cell({ r: row, c: 14 })] = { t: 's', v: product.rawSku };
  sheet[XLSX.utils.encode_cell({ r: row, c: 15 })] = { t: 'n', v: 1 };
}
sheet['!ref'] = `A1:BV${products.length + 1}`;
if (sheet.A1?.v !== '*เลข SKU' || sheet.B1?.v !== '*ชื่อ SKU' || sheet.O1?.v !== '*SKU เดียว 1' || sheet.P1?.v !== '*จำนวน SKU1') throw new Error('Required BigSeller create-Bundle columns were not preserved');

const outputPath = path.join(root, 'outputs/bigseller-bundle-sync-20260922/bigseller-create-missing-4gb-bundles.xlsx');
XLSX.writeFile(workbook, outputPath, { bookType: 'xlsx', compression: true });
console.log(JSON.stringify({ rows: products.length, skus: products.map(({ sku }) => sku), outputPath }));
