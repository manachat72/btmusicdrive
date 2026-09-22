const XLSX = require('xlsx');
const path = require('path');

const inputPath = 'C:/Users/may/Downloads/mass_update_basic_info_134575937_20260921202113.xlsx';
const outputPath = path.join(__dirname, 'shopee-main-skus-fixed.xlsx');

// Lazada product ID -> SKU generated from the same NAS series used by the main website.
const skuByProductId = new Map([
  ['56366105048', 'BT-ST-02-036'], ['55311412681', 'BT-PC-04-040'],
  ['54566333816', 'BT-LT-04-025'], ['54167002044', 'BT-PC-01-053'],
  ['54066880446', 'BT-PC-02-055'], ['53016199417', 'BT-LT-04-047'],
  ['51818066819', 'BT-PC-02-012'], ['51615874307', 'BT-RD-00-029'],
  ['49408601903', 'BT-TA-04-023'], ['47466100795', 'BT-ST-01-051'],
  ['45516898256', 'BT-DM-16-052'], ['43916593018', 'BT-RD-00-061'],
  ['43712225868', 'BT-RD-00-029'], ['40527622841', 'BT-DM-16-029'],
  ['28641234052', 'BT-PC-02-045'], ['28629135650', 'BT-DM-M5-041'],
]);

const workbook = XLSX.readFile(inputPath, { cellStyles: true, cellNF: true, cellDates: true });
const sheet = workbook.Sheets.Sheet1;
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
let changed = 0;
for (let row = 6; row < rows.length; row++) {
  const productId = String(rows[row][0] || '').trim();
  if (!productId) continue;
  const sku = skuByProductId.get(productId);
  if (!sku) throw new Error(`No verified SKU for Lazada Product ID ${productId}`);
  if (String(rows[row][1] || '') !== sku) changed++;
  sheet[XLSX.utils.encode_cell({ r: row, c: 1 })] = { t: 's', v: sku };
}

XLSX.writeFile(workbook, outputPath, { bookType: 'xlsx', bookSST: true, compression: true });

const check = XLSX.readFile(outputPath);
const outRows = XLSX.utils.sheet_to_json(check.Sheets.Sheet1, { header: 1, defval: '', raw: true }).slice(6).filter(r => r[0]);
const invalid = outRows.filter(r => !/^BT-[A-Z]{2}-[0-9A-Z]{2}-\d{3}$/.test(String(r[1] || '')));
if (outRows.length !== skuByProductId.size || invalid.length) {
  throw new Error(`Verification failed: rows=${outRows.length}, invalidSku=${invalid.length}`);
}
console.log(JSON.stringify({ rows: outRows.length, changed, outputPath }));
