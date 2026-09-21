const fs = require('fs');
const XLSX = require('xlsx');

// load mapping
const products = JSON.parse(fs.readFileSync('products.json', 'utf8'));
const nameToSku = {};
for (const p of products) {
  nameToSku[p.name.trim()] = p.sku;
}

// read CSV
const workbook = XLSX.readFile('lazada_input.csv', { type: 'file' });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

let updated = 0;
let checked = 0;
let errors = [];
for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  const id = row[0];
  const name = row[2];
  const currentSku = row[11]; // index 11 is SellerSKU
  
  if (id && /^\d{5,}$/.test(String(id))) {
    checked++;
    const cleanName = String(name).trim();
    let targetSku = nameToSku[cleanName];
    
    if (!targetSku) {
      const matched = products.find(p => cleanName.includes(p.name.trim()) || p.name.trim().includes(cleanName));
      if (matched) targetSku = matched.sku;
    }
    
    if (targetSku) {
      if (currentSku !== targetSku) {
        console.log(`[${id}] "${cleanName}":`);
        console.log(`   Changing SKU: ${currentSku} -> ${targetSku}`);
        row[11] = targetSku;
        updated++;
      } else {
        console.log(`[${id}] "${cleanName}":`);
        console.log(`   SKU is CORRECT (${currentSku})`);
      }
    } else {
       errors.push(`Not found in products.json: ${cleanName}`);
    }
  }
}

console.log('\nSUMMARY:');
console.log('Checked ' + checked + ' products.');
console.log('Updated ' + updated + ' SKUs.');
if (errors.length) {
    console.log('Errors:');
    errors.forEach(e => console.log('  ' + e));
}

const newWorkbook = XLSX.utils.book_new();
const newSheet = XLSX.utils.aoa_to_sheet(rows);
XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'Sheet1');
XLSX.writeFile(newWorkbook, 'lazada_updated.xlsx');
console.log('Saved to lazada_updated.xlsx');
