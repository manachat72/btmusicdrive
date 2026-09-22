import path from 'node:path';
import XLSX from 'xlsx';

const root = 'C:/Users/may/programpython/btmusicdrive';
const sourcePath = path.join(root, 'outputs/bigseller-bundle-sync-20260922/update-bundle-template.xlsx');
const outputPath = path.join(root, 'outputs/bigseller-bundle-sync-20260922/bigseller-update-missing-4gb-bundles.xlsx');
const skus = ['BT-TA-04-023', 'BT-LT-04-025', 'BT-LT-04-047'];

const workbook = XLSX.readFile(sourcePath, { cellStyles: true, cellNF: true, cellFormula: true });
const sheet = workbook.Sheets.SKU;
for (let row = 2; row <= 5001; row += 1) {
  for (let column = 0; column < 80; column += 1) delete sheet[XLSX.utils.encode_cell({ r: row - 1, c: column })];
}
for (const [index, sku] of skus.entries()) {
  const row = index + 1;
  sheet[XLSX.utils.encode_cell({ r: row, c: 0 })] = { t: 's', v: sku };
  sheet[XLSX.utils.encode_cell({ r: row, c: 20 })] = { t: 's', v: 'RAW-4GB' };
  sheet[XLSX.utils.encode_cell({ r: row, c: 21 })] = { t: 'n', v: 1 };
}
sheet['!ref'] = 'A1:CB4';
if (sheet.A1?.v !== '*เลข SKU' || sheet.U1?.v !== 'SKU เดียว 1' || sheet.V1?.v !== 'จำนวน SKU1' || sheet.CA1?.v !== 'จำนวน SKU20') throw new Error('Required update-Bundle columns were not preserved');
XLSX.writeFile(workbook, outputPath, { bookType: 'xlsx', compression: true });
console.log(JSON.stringify({ rows: skus.length, outputPath }));
