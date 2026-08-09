#!/usr/bin/env node
/**
 * เติมข้อมูลสินค้าลงเทมเพลต batch upload ของ TikTok Shop อัตโนมัติ
 *
 * แหล่งข้อมูล:
 *   1. templates/marketplace-listings.xlsx (ชีต "TikTok Shop") — สร้างจาก npm run mkt:listings
 *      → ชื่อ SEO, รายละเอียด, Hashtags, ราคา, สต็อก, SKU, ลิงก์รูป R2
 *   2. เทมเพลต TikTok ที่ดาวน์โหลดจาก Seller Center (หาใน Downloads อัตโนมัติ)
 *
 * หมายเหตุ: TikTok รับ "URL รูปภาพสาธารณะ" ได้โดยตรง — ไม่ต้องอัปรูปเข้าศูนย์จัดการสื่อก่อน
 * รูปกลางบน img.btmusicdrive.com (JPEG 1200×1200 ≤5MB) ผ่านเกณฑ์ทุกข้อ
 *
 * Usage:
 *   node scripts/fill-tiktok-template.js              # dry-run
 *   node scripts/fill-tiktok-template.js --apply      # เขียน templates/tiktok-upload-filled.xlsx
 *   node scripts/fill-tiktok-template.js --apply --template "C:\\path\\to\\template.xlsx"
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'templates');
const HOME = process.env.USERPROFILE || process.env.HOME || '';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const arg = (f) => { const i = argv.indexOf(f); return i !== -1 && argv[i + 1] ? argv[i + 1] : null; };

// ═══ ตั้งค่า — แก้ตรงนี้ที่เดียว ═══
const CONFIG = {
  category: 'ที่จัดเก็บข้อมูลและซอฟต์แวร์/แฟลชไดรฟ์และสาย OTG',   // ต้องตรงกับชีต Category ในเทมเพลตเป๊ะ ๆ
  brand: 'Bt music drive (7671817741703300871)',                    // ต้องตรงกับชีต Brand ในเทมเพลตเป๊ะ ๆ
  weightG: 100,          // น้ำหนักพัสดุ (กรัม)
  length: 10, width: 10, height: 5,   // ซม.
  // สินค้าที่ชื่อเข้า pattern นี้ไม่ใช่แฟลชไดรฟ์ (เช่น วิทยุ) — เว้นหมวดหมู่ไว้ให้เลือกเองใน Seller Center
  notFlashDrive: /วิทยุ|radio/i,
};

// โครงเทมเพลต TikTok (แถวจริงในไฟล์): 1=machine keys(ซ่อน) 2=config(ซ่อน) 3=หัวตาราง
// 4=บังคับ/ไม่บังคับ 5=คำอธิบาย 6=แถวตัวอย่าง(ต้องลบ) → ข้อมูลเริ่มแถว 7
const EXAMPLE_ROW = 5;      // 0-based → แถว 6
const DATA_START_ROW = 6;   // 0-based → แถว 7
const LAST_COL = 27;        // AB

// ── main ──
(() => {
  // 1) เทมเพลต TikTok
  const findTpl = () => {
    const dirs = [OUT_DIR, path.join(HOME, 'Downloads'), path.join(HOME, 'Desktop')];
    for (const d of dirs) {
      try {
        const hit = fs.readdirSync(d)
          .filter(f => /tiktok.*batchupload.*template.*\.xlsx$/i.test(f) && !f.startsWith('~$') && !/filled/i.test(f))
          .map(f => path.join(d, f))
          .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
        if (hit) return hit;
      } catch { }
    }
    return null;
  };
  const tplFile = arg('--template') || findTpl();
  if (!tplFile || !fs.existsSync(tplFile)) {
    console.error('✖ ไม่พบเทมเพลต TikTok (Tiktok*batchupload*template*.xlsx) ใน Downloads — ใส่ --template เอง');
    process.exit(1);
  }
  console.log(`template : ${tplFile}`);

  // 2) ข้อมูลจาก marketplace-listings.xlsx ชีต TikTok Shop
  const listFile = path.join(OUT_DIR, 'marketplace-listings.xlsx');
  if (!fs.existsSync(listFile)) {
    console.error('✖ ไม่พบ templates/marketplace-listings.xlsx — รัน npm run mkt:listings ก่อน');
    process.exit(1);
  }
  const lwb = XLSX.read(fs.readFileSync(listFile), { type: 'buffer' });
  const items = XLSX.utils.sheet_to_json(lwb.Sheets['TikTok Shop'], { defval: '' });
  console.log(`ข้อมูล    : ${items.length} รายการ (ชีต TikTok Shop)`);

  // 3) เปิดเทมเพลต + ตรวจว่าหมวดหมู่/แบรนด์ตรงกับดรอปดาวน์จริง
  const wb = XLSX.read(fs.readFileSync(tplFile), { type: 'buffer', cellStyles: false });
  const ws = wb.Sheets['Template'];
  if (!ws) { console.error(`✖ ไม่พบชีต "Template" (มี: ${wb.SheetNames.join(', ')})`); process.exit(1); }

  const listOf = (sheet) => XLSX.utils.sheet_to_json(wb.Sheets[sheet] || {}, { header: 1, defval: '' })
    .map(r => String(r[0] ?? '').trim()).filter(Boolean);
  const cats = listOf('Category');
  const brands = listOf('Brand');
  if (!cats.includes(CONFIG.category)) console.warn(`⚠ หมวดหมู่ "${CONFIG.category}" ไม่อยู่ในชีต Category — เช็คสะกดให้ตรงเป๊ะ`);
  if (!brands.includes(CONFIG.brand)) console.warn(`⚠ แบรนด์ "${CONFIG.brand}" ไม่อยู่ในชีต Brand`);

  // 4) map คอลัมน์ A..AB ตามหัวเทมเพลต
  const rows = [];
  let skippedCat = 0;
  for (const it of items) {
    const name = String(it['ชื่อสินค้า (SEO ≤255)'] ?? '').slice(0, 255);
    if (!name) continue;
    const isOther = CONFIG.notFlashDrive.test(name);
    if (isOther) skippedCat++;
    const desc = [String(it['รายละเอียด'] ?? ''), '', String(it['Hashtags'] ?? '')].join('\n').trim();
    const imgs = ['ภาพปก', 'รูป 1', 'รูป 2', 'รูป 3', 'รูป 4', 'รูป 5', 'รูป 6', 'รูป 7', 'รูป 8']
      .map(k => String(it[k] ?? ''));

    rows.push([
      isOther ? '' : CONFIG.category,   // A หมวดหมู่ (วิทยุ → เว้นไว้เลือกเอง)
      CONFIG.brand,                     // B แบรนด์
      name,                             // C ชื่อสินค้า
      desc,                             // D คำอธิบาย (รวม hashtags ท้ายข้อความ)
      ...imgs,                          // E-M ภาพหลัก + ภาพ 2-9
      '', '', '', '', '',               // N-R ตัวเลือกสินค้า (ไม่มี variant)
      CONFIG.weightG,                   // S น้ำหนักพัสดุ (g)
      CONFIG.length, CONFIG.width, CONFIG.height,  // T-V ขนาดพัสดุ
      '',                               // W ตัวเลือกในการจัดส่ง
      it['ราคา'] ?? '',                 // X ราคาขายปลีก
      '',                               // Y พรีออเดอร์
      it['สต็อก'] ?? '',                // Z ปริมาณ
      it['SKU'] ?? '',                  // AA SKU ของผู้ขาย
      '',                               // AB ตารางขนาด
    ]);
    console.log(`  ${it.Code}  ${isOther ? '⚠ เว้นหมวดหมู่' : '✓'}  ${imgs.filter(Boolean).length} รูป  ${name.slice(0, 50)}`);
  }

  console.log(`\nทั้งหมด ${rows.length} รายการ${skippedCat ? ` · ${skippedCat} รายการไม่ใช่แฟลชไดรฟ์ — ไปเลือกหมวดหมู่เองในไฟล์/Seller Center` : ''}`);

  if (!APPLY) { console.log('\n(dry run — ใส่ --apply เพื่อเขียนไฟล์)'); return; }

  // ⚠ แถว 1-2 (machine keys + config) อยู่นอก !ref ของไฟล์ต้นฉบับ — ต้องขยาย range ให้ครอบ
  // ไม่งั้นตอนเขียนไฟล์ แถวที่ TikTok ใช้ parse จะหายและอัปโหลดไม่ผ่าน
  const range = XLSX.utils.decode_range(ws['!ref']);
  range.s.r = 0; range.s.c = 0;
  range.e.r = Math.max(range.e.r, DATA_START_ROW + rows.length - 1);
  range.e.c = Math.max(range.e.c, LAST_COL);
  ws['!ref'] = XLSX.utils.encode_range(range);

  // ลบแถวตัวอย่างของ TikTok (แถว 6) ไม่ให้ถูกอัปเป็นสินค้าจริง
  XLSX.utils.sheet_add_aoa(ws, [new Array(LAST_COL + 1).fill('')], { origin: { r: EXAMPLE_ROW, c: 0 } });
  XLSX.utils.sheet_add_aoa(ws, rows, { origin: { r: DATA_START_ROW, c: 0 } });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, 'tiktok-upload-filled.xlsx');
  XLSX.writeFile(wb, outFile, { bookType: 'xlsx' });
  console.log(`\n✔ templates/tiktok-upload-filled.xlsx  (${rows.length} รายการ)`);
  console.log('  อัปโหลดที่ Seller Center → สินค้า → เพิ่มสินค้าเป็นชุด (Batch upload)');
  console.log('  ⚠ รายการวิทยุยังไม่มีหมวดหมู่ — เปิดไฟล์เลือกจากดรอปดาวน์คอลัมน์ A ก่อนอัป');
})();
