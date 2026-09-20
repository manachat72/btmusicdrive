/**
 * เติมข้อมูลสินค้าลงเทมเพลต "นำเข้าเพื่อเพิ่ม SKU Merchant" ของ BigSeller
 *
 *   node scripts/fill-bigseller-sku.js "<เทมเพลต.xlsx>" --apply
 *   ... --cost "1GB=35,2GB=45,4GB=60,16GB=120,512MB=30" --extra 12
 *   ... --out "<ไฟล์ปลายทาง.xlsx>"
 *
 * --cost  ต้นทุนแฟลชไดรฟ์เปล่าแยกตามความจุ (บาท)  · --extra ค่าปก+ซอง+อื่น ๆ ต่อชิ้น (บาท)
 *         ต้นทุนในไฟล์ = ไดรฟ์ตามความจุ + extra · ไม่ใส่ = เว้นช่องต้นทุนไว้ให้กรอกเอง
 *
 * ความจุอ่านจาก SKU (BT-<หมวด>-<ความจุ>-<ชุด>) ไม่ใช่จาก specs — SKU คือตัวที่ทุกแพลตฟอร์มเห็นตรงกัน
 * รูปใช้ลิงก์ชุดเดียวกับที่ส่งขึ้นร้าน (reports/mid-images.json) · น้ำหนัก/ขนาดกล่องดึงจากไฟล์ Shopee ถ้าส่งมาด้วย
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { parseSku } = require('./lib/sku');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const SRC = args.find(a => !a.startsWith('--') && /\.xlsx$/i.test(a));
const val = flag => (args.includes(flag) ? args[args.indexOf(flag) + 1] : '');
const OUT = val('--out') || (SRC || '').replace(/\.xlsx$/i, '-filled.xlsx');
const SHOPEE = val('--shopee') || '';
const EXTRA = parseFloat(val('--extra') || '0') || 0;
const SHIPPING = parseFloat(val('--shipping') || '0') || 0;   // ค่าส่งที่ร้านออกเอง ต่อชิ้น
const KEY = (val('--key') || 'code').toLowerCase();            // ช่องแรกของเทมเพลตต้นทุน: code | name
const DEFAULT_WEIGHT_G = 100;   // ค่าที่ใช้อยู่ในไฟล์ Shopee: 0.1 กก.
const DEFAULT_BOX = { l: 10, w: 10, h: 3 };

if (!SRC) { console.error('❌ ใส่ path เทมเพลต SKU Merchant (.xlsx) มาด้วย'); process.exit(1); }

/** "1GB=35,4GB=60" → {"01":35,"04":60} (คีย์เป็นรหัสความจุใน SKU) */
const COST = {};
for (const part of (val('--cost') || '').split(',').map(s => s.trim()).filter(Boolean)) {
  const m = part.match(/^(\d+)\s*(GB|MB|TB)?\s*=\s*([\d.]+)$/i);
  if (!m) { console.error(`❌ รูปแบบ --cost ผิดตรง "${part}" (ตัวอย่าง 4GB=60)`); process.exit(1); }
  const n = parseInt(m[1], 10), unit = (m[2] || 'GB').toUpperCase();
  const code = unit === 'MB' ? 'M' + String(n).charAt(0) : unit === 'TB' ? 'T' + n : String(n).padStart(2, '0');
  COST[code] = parseFloat(m[3]);
}

const products = (() => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));
  return (Array.isArray(j) ? j : j.products || []).filter(p => parseSku(p.sku));
})();
const midMap = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'reports', 'mid-images.json'), 'utf8')); } catch { return {}; }
})();

/** น้ำหนัก/ขนาดกล่องจากไฟล์ Shopee ที่กรอกไว้แล้ว (ถ้ามี) */
const dims = {};
if (SHOPEE && fs.existsSync(SHOPEE)) {
  const wb = XLSX.readFile(SHOPEE);
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
    const head = rows.findIndex(r => r.some(c => /^ps_sku_short/.test(String(c))));
    if (head < 0) continue;
    const k = rows[head].map(c => String(c).split('|')[0]);
    const idx = n => k.indexOf(n);
    for (const r of rows.slice(head + 1)) {
      const sku = String(r[idx('ps_sku_short')] || '').trim();
      if (!/^BT-/.test(sku)) continue;
      dims[sku] = {
        g: Math.round((parseFloat(r[idx('ps_weight')]) || 0.1) * 1000),
        l: parseFloat(r[idx('ps_length')]) || DEFAULT_BOX.l,
        w: parseFloat(r[idx('ps_width')]) || DEFAULT_BOX.w,
        h: parseFloat(r[idx('ps_height')]) || DEFAULT_BOX.h,
      };
    }
    break;
  }
}

/**
 * เทมเพลต import_inventory_sku — ตั้งต้นทุน/ค่าธรรมเนียมรายตัว
 * ช่องแรก "*ชื่อSKU" ปกติคือรหัส SKU (BT-…) ถ้าระบบฟ้องว่าหาไม่เจอ ให้รันซ้ำด้วย --key name
 */
function fillInventory() {
  const ws = wb.Sheets[sheet];
  const header = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })[0]
    .map(c => String(c).replace(/^\*/, '').replace(/\s*\((?:required|จำเป็น)[^)]*\)\s*$/i, '').replace(/\s+/g, '').trim());
  const col = re => header.findIndex(h => re.test(h));
  const C = {
    key: col(/^ชื่อSKU$/), status: col(/^สถานะการขาย$/), cost: col(/^ต้นทุนSKU$/),
    ship: col(/^ค่าจัดส่ง$/), note: col(/^หมายเหตุ$/), vat: col(/VAT/),
  };
  const set = (r, c, v) => { if (c >= 0 && v !== '' && v != null) ws[XLSX.utils.encode_cell({ r, c })] = { t: typeof v === 'number' ? 'n' : 's', v }; };
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let r = 1; r <= range.e.r; r++) header.forEach((_, c) => delete ws[XLSX.utils.encode_cell({ r, c })]);

  let noCost = 0;
  products.forEach((p, i) => {
    const r = i + 1, s = parseSku(p.sku);
    const capText = (p.specs && (p.specs['ความจุ'] || p.specs.capacity)) || '';
    const cost = COST[s.capacity] != null ? +(COST[s.capacity] + EXTRA).toFixed(2) : '';
    if (cost === '') noCost++;
    set(r, C.key, KEY === 'name' ? String(p.name).slice(0, 120) : p.sku);
    set(r, C.status, 'ขายอยู่');
    set(r, C.cost, cost);
    if (SHIPPING) set(r, C.ship, SHIPPING);
    set(r, C.note, `${p.sku} · ชุด NAS ${String(s.no).padStart(3, '0')} · ${capText || '-'}`);
  });
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: products.length, c: range.e.c } });

  console.log(`เทมเพลตต้นทุน/ค่าธรรมเนียม · สินค้า ${products.length} ตัว · ใส่ต้นทุน ${products.length - noCost} ตัว` +
    (SHIPPING ? ` · ค่าจัดส่ง ${SHIPPING} บาท/ชิ้น` : ' · ไม่ได้ใส่ค่าจัดส่ง (--shipping)') +
    ` · ช่องแรกใช้ ${KEY === 'name' ? 'ชื่อสินค้า' : 'รหัส SKU'}`);
  if (!APPLY) { console.log('(dry-run — ยังไม่เขียนไฟล์ · สั่ง --apply)'); return; }
  XLSX.writeFile(wb, OUT, { bookType: 'xlsx' });
  console.log(`✔ บันทึก: ${OUT}`);
}

const wb = XLSX.readFile(SRC, { cellStyles: true });
const sheet = wb.SheetNames.find(n => {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' });
  return rows[0] && rows[0].some(c => /(เลข|ชื่อ)\s*SKU/.test(String(c)));   // รองรับทั้ง 2 เทมเพลต
});
if (!sheet) { console.error('❌ หาหัวตาราง SKU ในไฟล์ไม่เจอ — ไฟล์นี้ใช่เทมเพลตของ BigSeller ไหม'); process.exit(1); }

const ws0 = wb.Sheets[sheet];
const head0 = XLSX.utils.sheet_to_json(ws0, { header: 1, defval: '' })[0].map(c => String(c));
// เทมเพลต "ต้นทุน/ค่าธรรมเนียมต่อ SKU" (import_inventory_sku) คนละใบกับตัวสร้าง SKU Merchant
if (head0.some(c => /ต้นทุน\s*SKU/.test(c))) { fillInventory(); process.exit(0); }

const ws = wb.Sheets[sheet];
// หัวคอลัมน์บังคับมาในรูป "*เลข SKU (Required)" — ตัดทั้งดอกจันและวงเล็บท้ายก่อนเทียบชื่อ
const header = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })[0]
  .map(c => String(c).replace(/^\*/, '').replace(/\s*\((?:required|จำเป็น)[^)]*\)\s*$/i, '').trim());
const col = label => header.findIndex(h => h === label);
const C = {
  sku: col('เลข SKU'), name: col('ชื่อ SKU'), cat: col('หมวดหมู่'), cost: col('ต้นทุน'),
  costRef: col('อ้างอิงราคาต้นทุน'), priceRef: col('อ้างอิงราคาขาย'), brand: col('แบรนด์'),
  netG: col('น้ำหนักสุทธิ(g)'), grossG: col('น้ำหนักรวม(g)'), l: col('ความยาว(cm)'),
  w: col('ความกว้าง(cm)'), h: col('ความสูง(cm)'), img: col('Image URL'),
  tag: col('แท็ก'), note: col('หมายเหตุ SKU Merchant'), unit: col('หน่วยพื้นฐาน'),
  expiry: col('การจัดการวันหมดอายุ'),
};

const set = (r, c, v) => { if (c >= 0 && v !== '' && v != null) ws[XLSX.utils.encode_cell({ r, c })] = { t: typeof v === 'number' ? 'n' : 's', v }; };
const clearRow = r => header.forEach((_, c) => delete ws[XLSX.utils.encode_cell({ r, c })]);

const range = XLSX.utils.decode_range(ws['!ref']);
for (let r = 1; r <= range.e.r; r++) clearRow(r);          // ลบแถวตัวอย่างของเทมเพลตทิ้ง

let noCost = 0;
products.forEach((p, i) => {
  const r = i + 1;
  const s = parseSku(p.sku);
  const d = dims[p.sku] || { g: DEFAULT_WEIGHT_G, ...DEFAULT_BOX };
  const capText = (p.specs && (p.specs['ความจุ'] || p.specs.capacity)) || '';
  const cost = COST[s.capacity] != null ? +(COST[s.capacity] + EXTRA).toFixed(2) : '';
  if (cost === '') noCost++;

  set(r, C.sku, p.sku);
  set(r, C.name, String(p.name).slice(0, 120));
  set(r, C.cat, (p.category && (p.category.name || p.category)) || s.categoryName || '');
  set(r, C.cost, cost);
  set(r, C.costRef, cost);
  set(r, C.priceRef, Number(p.price) || '');
  set(r, C.brand, p.brand || 'btmusicdrive');
  set(r, C.netG, d.g); set(r, C.grossG, d.g);
  set(r, C.l, d.l); set(r, C.w, d.w); set(r, C.h, d.h);
  set(r, C.img, (midMap[p.sku] && midMap[p.sku].images[0]) || p.imageUrl || '');
  set(r, C.tag, [s.categoryName, capText].filter(Boolean).join(','));
  set(r, C.note, `ชุด NAS ${String(s.no).padStart(3, '0')} · ${capText || '-'}`);
  set(r, C.unit, 'ชิ้น');
  // "การจัดการวันหมดอายุ" ปล่อยว่าง = ไม่เปิดใช้ — อย่าใส่ค่าเอง ค่าที่ระบบรับมีแค่ชุดของมันเอง
});

ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: products.length, c: range.e.c } });

console.log(`สินค้า ${products.length} ตัว · ต้นทุน: ${products.length - noCost} ตัว` +
  (noCost ? ` · ยังไม่มีต้นทุน ${noCost} ตัว (ใส่ --cost "1GB=.. ,4GB=.." --extra ..)` : ''));
if (Object.keys(COST).length) {
  console.log('ต้นทุนที่ใช้: ' + Object.entries(COST).map(([k, v]) => `${k}→${v}+${EXTRA}=${v + EXTRA}`).join(' · '));
}
if (!APPLY) { console.log('(dry-run — ยังไม่เขียนไฟล์ · สั่ง --apply)'); process.exit(0); }
XLSX.writeFile(wb, OUT, { bookType: 'xlsx' });
console.log(`✔ บันทึก: ${OUT}`);
