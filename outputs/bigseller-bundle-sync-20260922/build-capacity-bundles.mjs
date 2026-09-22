import fs from 'node:fs/promises';
import path from 'node:path';
import XLSX from 'xlsx';

const root = 'C:/Users/may/programpython/btmusicdrive';
const sourcePath = path.join(root, 'outputs/bigseller-bundle-sync-20260922/update-bundle-template.xlsx');
const outputPath = path.join(root, 'outputs/bigseller-bundle-sync-20260922/bigseller-bundle-capacity-sync-v2.xlsx');
const rawByCapacity = { '01': 'RAW-1GB', '02': 'RAW-2GB', '04': 'RAW-4GB', '08': 'RAW-8GB', '16': 'RAW-16GB', '32': 'RAW-32GB', M5: 'RAW-512MB' };

const source = JSON.parse(await fs.readFile(path.join(root, 'products.json'), 'utf8'));
const products = (Array.isArray(source) ? source : source.products)
  .map((product) => ({ product, match: String(product.sku || '').match(/^BT-[A-Z]{2}-([0-9A-Z]{2})-\d{3}$/) }))
  .filter(({ match }) => match && rawByCapacity[match[1]])
  .map(({ product, match }) => ({ sku: product.sku, rawSku: rawByCapacity[match[1]] }));

const workbook = XLSX.readFile(sourcePath, { cellStyles: true, cellNF: true, cellFormula: true });
const sheet = workbook.Sheets.SKU;
for (let row = 2; row <= 5001; row += 1) {
  for (let column = 0; column < 80; column += 1) delete sheet[XLSX.utils.encode_cell({ r: row - 1, c: column })];
}
for (const [index, { sku, rawSku }] of products.entries()) {
  const row = index + 1;
  sheet[XLSX.utils.encode_cell({ r: row, c: 0 })] = { t: 's', v: sku };
  sheet[XLSX.utils.encode_cell({ r: row, c: 20 })] = { t: 's', v: rawSku };
  sheet[XLSX.utils.encode_cell({ r: row, c: 21 })] = { t: 'n', v: 1 };
}
sheet['!ref'] = `A1:CB${products.length + 1}`;

const rows = products.map(({ sku, rawSku }) => [sku, rawSku, 1]);
const invalid = rows.filter(([sku, rawSku, quantity]) => !/^BT-[A-Z]{2}-[0-9A-Z]{2}-\d{3}$/.test(String(sku)) || !/^RAW-(?:512MB|1GB|2GB|4GB|8GB|16GB|32GB)$/.test(String(rawSku)) || quantity !== 1);
if (invalid.length) throw new Error(`Invalid bundle rows: ${invalid.length}`);

const summary = Object.fromEntries(Object.entries(rawByCapacity).map(([capacity, rawSku]) => [rawSku, products.filter((product) => product.rawSku === rawSku).length]).filter(([, count]) => count));
XLSX.writeFile(workbook, outputPath, { bookType: 'xlsx', compression: true });
const headerRange = XLSX.utils.decode_range(sheet['!ref']);
if (headerRange.e.c !== 79 || sheet.V1?.v !== 'จำนวน SKU1' || sheet.CA1?.v !== 'จำนวน SKU20') throw new Error('Required BigSeller columns were not preserved');
console.log(JSON.stringify({ rows: products.length, summary, outputPath }));
