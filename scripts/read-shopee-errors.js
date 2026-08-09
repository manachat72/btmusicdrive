#!/usr/bin/env node
/**
 * อ่านไฟล์ผลอัปโหลดที่ Shopee ส่งกลับ (ปุ่ม "ดาวน์โหลด") แล้วสรุปว่าติดอะไร
 *
 * Usage:
 *   node scripts/read-shopee-errors.js
 *   node scripts/read-shopee-errors.js --file "C:\\Users\\may\\Downloads\\xxx.xlsx"
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const HOME = process.env.USERPROFILE || process.env.HOME || '';
const argv = process.argv.slice(2);
const i = argv.indexOf('--file');

function newest(dir, re) {
  try {
    return fs.readdirSync(dir)
      .filter(f => re.test(f) && !f.startsWith('~$'))
      .map(f => path.join(dir, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
  } catch { return null; }
}

const FILE = (i !== -1 && argv[i + 1]) || newest(path.join(HOME, 'Downloads'), /\.xlsx$/i);
if (!FILE || !fs.existsSync(FILE)) { console.error('✖ ไม่พบไฟล์'); process.exit(1); }
console.log(`ไฟล์: ${FILE}\n`);

const wb = XLSX.read(fs.readFileSync(FILE), { type: 'buffer' });

for (const sn of wb.SheetNames) {
  const ws = wb.Sheets[sn];
  if (!ws || !ws['!ref']) continue;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });

  // หาคอลัมน์ "เหตุผล" / reason / error
  let reasonCol = -1, nameCol = -1, headerRow = -1;
  for (let r = 0; r < Math.min(5, rows.length); r++) {
    (rows[r] || []).forEach((v, c) => {
      const s = String(v ?? '');
      if (reasonCol < 0 && /เหตุผล|reason|error|ข้อผิดพลาด/i.test(s)) { reasonCol = c; headerRow = r; }
      if (nameCol < 0 && /ps_product_name|ชื่อสินค้า/i.test(s)) nameCol = c;
    });
  }
  if (reasonCol < 0) continue;

  console.log('═'.repeat(70));
  console.log(`ชีต: ${sn}`);
  console.log('═'.repeat(70));

  const counts = new Map();
  const samples = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const reason = String(rows[r][reasonCol] ?? '').trim();
    if (!reason) continue;
    counts.set(reason, (counts.get(reason) || 0) + 1);
    if (samples.length < 5) samples.push({ row: r + 1, name: String(rows[r][nameCol] ?? '').slice(0, 40), reason });
  }

  if (!counts.size) { console.log('  (ไม่มีข้อความ error ในชีตนี้)\n'); continue; }

  console.log('\n── สรุปสาเหตุ (เรียงตามจำนวน) ──');
  [...counts.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([reason, n]) => console.log(`\n  [${n} แถว] ${reason}`));

  console.log('\n── ตัวอย่างแถว ──');
  samples.forEach(s => console.log(`  แถว ${s.row} · ${s.name} → ${s.reason.slice(0, 120)}`));
  console.log();
}
