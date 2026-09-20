/**
 * เปลี่ยนลิงก์รูปในไฟล์เทมเพลตของแพลตฟอร์ม (Shopee / Lazada / TikTok) ให้เป็นรูปชุดที่ตรงกับหน้าเว็บ
 *
 *   node scripts/fill-xlsx-images.js "<ไฟล์.xlsx>"            # dry-run — บอกว่าแถวไหนจะเปลี่ยนเป็นอะไร
 *   node scripts/fill-xlsx-images.js "<ไฟล์.xlsx>" --apply    # เขียนไฟล์ใหม่ลงท้าย -images-fixed.xlsx
 *   ... --out "<ไฟล์ปลายทาง.xlsx>"                            # ระบุที่บันทึกเอง
 *
 * ใช้ลิงก์จาก reports/mid-images.json (สร้างด้วย scripts/rebuild-mid-images.js)
 * จับคู่แถว↔สินค้าด้วย SKU ในคอลัมน์ ps_sku_short / "เลข SKU" — ไม่แตะคอลัมน์อื่นและไม่แตะชีตอื่น
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const SRC = args.find(a => !a.startsWith('--') && /\.xlsx$/i.test(a));
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1]
  : (SRC || '').replace(/\.xlsx$/i, '-images-fixed.xlsx');
const MAP_FILE = path.join(ROOT, 'reports', 'mid-images.json');

if (!SRC) { console.error('❌ ใส่ path ไฟล์ .xlsx มาด้วย'); process.exit(1); }
const MAP = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));

/** หาแถวหัวคอลัมน์ (แถวที่มีโค้ดคอลัมน์ ps_*) + แถวแรกของข้อมูลจริง */
function analyze(rows) {
  const head = rows.findIndex(r => r.some(c => /^ps_sku_short/.test(String(c))));
  if (head < 0) return null;
  const keys = rows[head].map(c => String(c).split('|')[0].trim());
  const sku = keys.indexOf('ps_sku_short');
  const cover = keys.indexOf('ps_item_cover_image');
  const imgs = keys.map((k, i) => ({ k, i })).filter(x => /^ps_item_image_\d+$/.test(x.k))
    .sort((a, b) => +a.k.replace(/\D/g, '') - +b.k.replace(/\D/g, '')).map(x => x.i);
  if (sku < 0 || (cover < 0 && !imgs.length)) return null;
  return { head, sku, cols: [cover, ...imgs].filter(i => i >= 0) };
}

const wb = XLSX.readFile(SRC, { cellStyles: true });
let changed = 0, missing = [], sheetUsed = '';

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  if (!ws || !ws['!ref']) continue;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
  const info = analyze(rows);
  if (!info) continue;
  if (/ตัวอย่าง|example/i.test(name)) continue;          // ชีตตัวอย่างของ Shopee ปล่อยไว้
  sheetUsed = name;

  for (let r = info.head + 1; r < rows.length; r++) {
    const sku = String(rows[r][info.sku] || '').trim();
    if (!sku || !/^BT-/.test(sku)) continue;
    const entry = MAP[sku];
    if (!entry) { missing.push(sku); continue; }
    const urls = entry.images.slice(0, info.cols.length);
    console.log(`${sku.padEnd(15)} ${String(urls.length).padStart(2)} ใบ → ${entry.slug}`);
    changed++;
    if (!APPLY) continue;
    info.cols.forEach((c, k) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (k < urls.length) ws[addr] = { t: 's', v: urls[k] };
      else delete ws[addr];                                 // รูปเดิมเกินจำนวนที่มี = ต้องลบ ไม่งั้นค้างรูปสินค้าตัวอื่น
    });
  }
}

console.log(`\nชีตที่แก้: ${sheetUsed || '(ไม่เจอ)'} · เปลี่ยนลิงก์ ${changed} แถว`);
if (missing.length) console.log(`⚠ ไม่มีข้อมูลรูปของ SKU: ${[...new Set(missing)].join(', ')}`);
if (!APPLY) { console.log('(dry-run — ยังไม่เขียนไฟล์ · สั่ง --apply)'); process.exit(0); }

XLSX.writeFile(wb, OUT, { bookType: 'xlsx' });
console.log(`✔ บันทึก: ${OUT}`);
