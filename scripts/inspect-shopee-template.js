#!/usr/bin/env node
/**
 * ส่องโครงสร้างเทมเพลต mass upload ของ Shopee เพื่อดูว่าคอลัมน์ไหนคืออะไร
 *
 * Usage:
 *   node scripts/inspect-shopee-template.js
 *   node scripts/inspect-shopee-template.js --file "D:\\path\\template.xlsx"
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const argv = process.argv.slice(2);
const i = argv.indexOf('--file');

const HOME = process.env.USERPROFILE || process.env.HOME || '';

/** หาไฟล์ Shopee_mass_upload*.xlsx ในโฟลเดอร์ที่กำหนด (ไม่ recursive) */
function findShopeeTemplate(dir) {
  try {
    return fs.readdirSync(dir)
      .filter(f => /^Shopee.*\.xlsx$/i.test(f) && !f.startsWith('~$'))
      .map(f => path.join(dir, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
  } catch { return null; }
}

// ลำดับการหาไฟล์: --file → templates/ → Downloads → Desktop → NAS
const ARG = i !== -1 ? argv[i + 1] : null;
// --file รับได้ทั้งไฟล์และโฟลเดอร์
const fromArg = ARG && fs.existsSync(ARG) && fs.statSync(ARG).isDirectory()
  ? findShopeeTemplate(ARG) : ARG;

const CANDIDATES = [
  fromArg,
  findShopeeTemplate(path.resolve(__dirname, '..', 'templates')),
  findShopeeTemplate(path.join(HOME, 'Downloads')),
  findShopeeTemplate(path.join(HOME, 'Desktop')),
  findShopeeTemplate('D:\\'),
  findShopeeTemplate('E:\\'),
  'Z:\\รูป\\รูปสินค้า\\ลงสินค้าแบบxlsx.xlsx',
].filter(Boolean);

const FILE = CANDIDATES.find(f => fs.existsSync(f));
if (!FILE) {
  console.error('✖ ไม่พบไฟล์เทมเพลต ลองใส่ --file "<path>"');
  console.error('  ที่หาไปแล้ว:\n   - ' + CANDIDATES.join('\n   - '));
  process.exit(1);
}

const wb = XLSX.read(fs.readFileSync(FILE), { type: 'buffer' });

console.log(`ไฟล์  : ${path.basename(FILE)}`);
console.log(`ชีต   : ${wb.SheetNames.join(' | ')}\n`);

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const ref = ws['!ref'];
  if (!ref) { console.log(`── [${name}] ว่าง\n`); continue; }

  const range = XLSX.utils.decode_range(ref);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: true, defval: '' });

  console.log('═'.repeat(70));
  console.log(`ชีต: ${name}   ขนาด: ${range.e.r + 1} แถว × ${range.e.c + 1} คอลัมน์`);
  console.log('═'.repeat(70));

  const HEADER_ROWS = 5;
  const DATA_ROWS = argv.includes('--data') ? 8 : 0;

  const show = (r) => {
    console.log(`\n--- แถว ${r + 1} ---`);
    (rows[r] || []).forEach((cell, c) => {
      const v = String(cell ?? '').replace(/\s+/g, ' ').trim();
      if (!v) return;
      console.log(`  ${XLSX.utils.encode_col(c)} : ${v.slice(0, 90)}`);
    });
  };

  for (let r = 0; r < Math.min(HEADER_ROWS, rows.length); r++) show(r);

  // แถวข้อมูลตัวอย่าง (ใส่ --data เพื่อดู) — ใช้ดูว่าค่าที่ Shopee ยอมรับหน้าตายังไง
  for (let r = HEADER_ROWS; r < Math.min(HEADER_ROWS + DATA_ROWS, rows.length); r++) {
    if ((rows[r] || []).every(c => !String(c ?? '').trim())) continue;
    show(r);
  }
  console.log();
}
