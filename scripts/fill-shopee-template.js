#!/usr/bin/env node
/**
 * เติมข้อมูลสินค้าลงเทมเพลต mass upload ของ Shopee อัตโนมัติ
 *
 * แหล่งข้อมูล:
 *   1. marketplace-images/catalog.json      → ลิงก์รูป (ภาพปก + รูปภาพ 1-8)
 *   2. products.json                        → ชื่อ, ราคา, รายละเอียด, SKU, สต็อก, แบรนด์
 *   3. ไฟล์ Shopee เก่าที่เคยกรอกแล้ว (--source) → น้ำหนัก, ขนาดพัสดุ, ช่องทางขนส่ง, ราคา (สำรอง)
 *
 * Usage:
 *   node scripts/fill-shopee-template.js                       # dry-run รายงานการจับคู่
 *   node scripts/fill-shopee-template.js --apply               # เขียนไฟล์ผลลัพธ์
 *   node scripts/fill-shopee-template.js --apply \
 *        --template "C:\\Users\\may\\Downloads\\Shopee.xlsx" \
 *        --source   "C:\\Users\\may\\Downloads\\ลงสินค้าแบบxlsx.xlsx"
 *
 * ผลลัพธ์: templates/shopee-upload-filled.xlsx + templates/shopee-fill-report.csv
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

const FORM_SHEET = 'แบบฟอร์มการลงสินค้า';
const HEADER_ROWS = 5;          // แถว 1-5 เป็นหัวตาราง ข้อมูลเริ่มแถว 6

// ═══ ตั้งค่าร้าน — แก้ตรงนี้ที่เดียว ═══
const CONFIG = {
  // Shopee ต้องการ "เลข ID" ของหมวดหมู่ ไม่ใช่ชื่อ — สคริปต์จะค้นเลขจากตารางในเทมเพลตให้เอง
  category: 'คอมพิวเตอร์และอุปกรณ์เสริม > อุปกรณ์เก็บข้อมูล > แฟลชไดรฟ์',
  categoryId: 101964,           // เลขหมวดหมู่ Shopee (แฟลชไดรฟ์) — ใส่ตรง ๆ ไม่ต้องค้นจากเทมเพลต
  price: 279,                   // ราคาเดียวทุกรายการ (ใส่ null ถ้าอยากใช้ราคาจาก products.json)
  stock: 100,
  weight: 1,                    // หน่วยตามที่เทมเพลตกำหนด
  length: 10, width: 10, height: 10,
  brand: 'btmusicdrive',
  // ช่องทางขนส่งที่เปิด — คีย์คือ channel_id.<id> ในแถว 1 ของเทมเพลต
  channels: {
    'channel_id.7000': true,    // Standard Delivery - ส่งธรรมดาในประเทศ
    'channel_id.7002': true,    // Express Delivery - ส่งด่วน
    'channel_id.70036': false,  // SPX Express - ผู้ซื้อรับที่จุดบริการ
    'channel_id.70126': true,   // Instant Delivery - ส่งทันที
  },
  channelOn: 'เปิด',            // ค่าที่เทมเพลตยอมรับ (เช็คจาก dropdown ในไฟล์ ถ้าไม่ใช่ให้แก้)
  channelOff: 'ปิด',
  // คุณลักษณะสินค้า — เติมเฉพาะคอลัมน์ที่เทมเพลตมีจริง (จับคู่ด้วย regex กับหัวคอลัมน์)
  attributes: [
    { match: /ประเภทหน่วยความจำแบบแฟลช|flash.?memory.?type/i, value: 'Flash Drive' },
    { match: /ระดับความเร็ว|speed.?class/i, value: 'Class 10' },
    { match: /ความจุ|capacity/i, value: null },   // null = ใช้ค่าต่อสินค้า (ตรวจจากชื่อ)
  ],
};

const DEFAULTS = { stock: CONFIG.stock, weight: CONFIG.weight, length: CONFIG.length, width: CONFIG.width, height: CONFIG.height };

// ─────────────────────────── helpers ───────────────────────────

const EXCLUDE = /(shopee-upload-filled|shopee-fill-report|shopee-overrides)/i;

function findFile(dir, re) {
  try {
    return fs.readdirSync(dir)
      .filter(f => re.test(f) && !f.startsWith('~$') && !EXCLUDE.test(f))
      .map(f => path.join(dir, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
  } catch { return null; }
}

function resolveInput(explicit, re, label) {
  const cands = [
    explicit,
    findFile(OUT_DIR, re),
    findFile(path.join(HOME, 'Downloads'), re),
    findFile(path.join(HOME, 'Desktop'), re),
  ].filter(Boolean);
  const hit = cands.find(f => fs.existsSync(f));
  if (!hit) console.warn(`  ⚠ ไม่พบไฟล์ ${label}`);
  return hit || null;
}

/** normalize ข้อความไทย/อังกฤษ เพื่อจับคู่ชื่อสินค้า */
function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[\u200b\ufeff]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')      // ตัดช่องว่าง/เครื่องหมายทั้งหมด
    .replace(/ํา/g, 'ำ');
}

/** Dice coefficient บน bigram — ใช้วัดความคล้ายของชื่อ */
function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const bg = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const A = bg(a), B = bg(b);
  let inter = 0;
  for (const [g, n] of A) if (B.has(g)) inter += Math.min(n, B.get(g));
  const total = [...A.values()].reduce((x, y) => x + y, 0) + [...B.values()].reduce((x, y) => x + y, 0);
  return total ? (2 * inter) / total : 0;
}

function bestMatch(title, entries) {
  const t = norm(title);
  let best = null, bestScore = 0;
  for (const e of entries) {
    const s = similarity(t, e._norm);
    if (s > bestScore) { bestScore = s; best = e; }
  }
  return { match: best, score: bestScore };
}

/** HTML → ข้อความล้วนสำหรับช่องรายละเอียดของ Shopee */
function htmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<img[^>]*>/gi, '')
    .replace(/<\/(p|div|h[1-6]|ul|ol|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 3000);   // Shopee จำกัดรายละเอียดที่ 3000 ตัวอักษร
}

/** อ่านชีตฟอร์ม → { keys: {machineKey: colIndex}, rows: [][] } */
function readForm(file) {
  const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer', cellStyles: false });

  const parse = (name) => {
    const ws = wb.Sheets[name];
    if (!ws || !ws['!ref']) return null;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: true, defval: '' });
    const keys = {};
    (rows[0] || []).forEach((cell, c) => {
      const k = String(cell ?? '').split('|')[0].trim();
      if (k) keys[k] = c;
    });
    return keys.ps_product_name != null ? { wb, ws, sheetName: name, rows, keys } : null;
  };

  // 1) ชื่อชีตมาตรฐาน → 2) ชีตไหนก็ได้ที่แถว 1 มี ps_product_name (ยกเว้นชีตตัวอย่าง)
  const ordered = [
    ...wb.SheetNames.filter(n => n === FORM_SHEET),
    ...wb.SheetNames.filter(n => n !== FORM_SHEET && !n.includes('ตัวอย่าง')),
    ...wb.SheetNames.filter(n => n.includes('ตัวอย่าง')),
  ];
  for (const n of ordered) { const r = parse(n); if (r) return r; }

  throw new Error(`ไม่พบชีตที่มีคอลัมน์ ps_product_name ใน ${path.basename(file)} (ชีตที่มี: ${wb.SheetNames.join(', ')})`);
}

/**
 * ค้นเลข ID ของหมวดหมู่จากตารางในเทมเพลต
 * (ชีต "เวลาจัดเตรียมสินค้าพรีออเดอร์" มี et_title_category_name / et_title_category_id)
 */
function resolveCategoryId(wb, wanted) {
  const want = norm(wanted);
  const leaf = norm(String(wanted).split('>').pop());
  let exact = null, byLeaf = [];

  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn];
    if (!ws || !ws['!ref']) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });

    let nameCol = -1, idCol = -1, hr = -1;
    for (let r = 0; r < Math.min(4, rows.length); r++) {
      (rows[r] || []).forEach((v, c) => {
        const s = String(v ?? '');
        if (nameCol < 0 && /et_title_category_name|ชื่อหมวดหมู่/i.test(s)) { nameCol = c; hr = r; }
        if (idCol < 0 && /et_title_category_id|รหัสหมวดหมู่/i.test(s)) idCol = c;
      });
      if (nameCol >= 0 && idCol >= 0) break;
    }
    if (nameCol < 0 || idCol < 0) continue;

    for (let r = hr + 1; r < rows.length; r++) {
      const nm = String(rows[r][nameCol] ?? '').trim();
      const id = String(rows[r][idCol] ?? '').trim();
      if (!nm || !/^\d+$/.test(id)) continue;
      const n = norm(nm);
      if (n === want) { exact = { id, name: nm }; break; }
      if (norm(nm.split('>').pop()) === leaf) byLeaf.push({ id, name: nm });
    }
    if (exact) break;
  }

  if (exact) return exact;
  if (byLeaf.length === 1) return byLeaf[0];
  if (byLeaf.length > 1) {
    // เลือกอันที่ path คล้ายที่สุด
    byLeaf.sort((a, b) => similarity(want, norm(b.name)) - similarity(want, norm(a.name)));
    return { ...byLeaf[0], ambiguous: byLeaf.slice(0, 5) };
  }
  return null;
}

/**
 * อ่านไฟล์ marketplace แบบไหนก็ได้ (Shopee / Lazada / TikTok) เพื่อดึงน้ำหนัก+ขนาดพัสดุ
 * หาโดยดูหัวคอลัมน์ใน 4 แถวแรก แล้ว match ด้วย regex ทั้งไทย/อังกฤษ
 */
function readGenericSpecs(file) {
  const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer' });
  const PATTERNS = {
    name: /product.?name|ชื่อสินค้า|item.?name/i,
    weight: /(package.?)?weight|น้ำหนัก/i,
    length: /(package.?)?length|ความยาว/i,
    width: /(package.?)?width|ความกว้าง/i,
    height: /(package.?)?height|ความสูง/i,
    price: /^price$|ราคา|retail.?price/i,
    desc: /description|รายละเอียด/i,
    stock: /stock|quantity|คลังสินค้า|จำนวน/i,
    sku: /^sku|seller.?sku|เลข ?sku/i,
  };

  let best = null;
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn];
    if (!ws || !ws['!ref']) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: true, defval: '' });

    for (let hr = 0; hr < Math.min(4, rows.length); hr++) {
      const cols = {};
      (rows[hr] || []).forEach((cell, c) => {
        const v = String(cell ?? '').trim();
        if (!v) return;
        for (const [k, re] of Object.entries(PATTERNS)) {
          if (cols[k] == null && re.test(v)) cols[k] = c;
        }
      });
      if (cols.name != null && cols.weight != null) {
        const data = rows.slice(hr + 1)
          .filter(r => String(r[cols.name] ?? '').trim())
          .map(r => ({
            _norm: norm(r[cols.name]),
            name: r[cols.name],
            weight: r[cols.weight], length: r[cols.length], width: r[cols.width],
            height: r[cols.height], price: r[cols.price],
            desc: r[cols.desc], stock: r[cols.stock], sku: r[cols.sku],
          }))
          .filter(d => String(d.weight ?? '').trim());
        if (data.length && (!best || data.length > best.data.length)) {
          best = { sheet: sn, headerRow: hr + 1, cols, data };
        }
      }
    }
  }
  return best;
}

// ─────────────────────────── main ───────────────────────────

(async () => {
  console.log('── หาไฟล์ ──');
  const templateFile = resolveInput(arg('--template'), /^Shopee.*\.xlsx$/i, 'เทมเพลตเปล่า (Shopee*.xlsx)');
  const sourceFile = resolveInput(arg('--source'), /ลงสินค้า.*\.xlsx$/i, 'ไฟล์เก่าที่เคยกรอก (ลงสินค้า*.xlsx)');
  if (!templateFile) process.exit(1);
  console.log(`  template : ${templateFile}`);
  console.log(`  source   : ${sourceFile || '(ไม่มี — จะใช้ค่าเริ่มต้น)'}`);

  const catalogPath = path.join(ROOT, 'marketplace-images', 'catalog.json');
  if (!fs.existsSync(catalogPath)) {
    console.error('✖ ไม่พบ marketplace-images/catalog.json — รัน npm run mkt:build ก่อน');
    process.exit(1);
  }
  let catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')).products;
  const CODE = arg('--code') ? String(arg('--code')).padStart(2, '0') : null;
  if (CODE) {
    catalog = catalog.filter(p => p.code === CODE);
    if (!catalog.length) { console.error(`✖ ไม่พบสินค้า code ${CODE} ใน catalog.json`); process.exit(1); }
    console.log(`  → เฉพาะสินค้า code ${CODE}`);
  }

  const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'))
    .map(p => ({ ...p, _norm: norm(p.name) }));

  // ── ข้อมูลจากไฟล์เก่า (น้ำหนัก/ขนาด/ช่องทางขนส่ง) ──
  let oldRows = [], oldKeys = {}, channelCols = [], specs = null;
  if (sourceFile) {
    try {
      const src = readForm(sourceFile);
      oldKeys = src.keys;
      channelCols = Object.keys(oldKeys).filter(k => k.startsWith('channel_id'));
      oldRows = src.rows.slice(HEADER_ROWS)
        .filter(r => String(r[oldKeys.ps_product_name] ?? '').trim())
        .map(r => ({ row: r, _norm: norm(r[oldKeys.ps_product_name]) }));
      console.log(`  → ไฟล์เก่า (รูปแบบ Shopee) มีสินค้า ${oldRows.length} รายการ`);
    } catch (e) {
      // ไม่ใช่ไฟล์ Shopee → ลองอ่านแบบทั่วไป (Lazada / TikTok) เพื่อเอาน้ำหนัก+ขนาด
      specs = readGenericSpecs(sourceFile);
      if (specs) {
        console.log(`  → ไฟล์เก่าเป็นรูปแบบอื่น อ่านจากชีต "${specs.sheet}" ได้ ${specs.data.length} รายการ (น้ำหนัก/ขนาด)`);
      } else {
        console.warn(`  ⚠ อ่านไฟล์เก่าไม่ได้: ${e.message}`);
      }
    }
  }

  const cell = (o, key) => (o && oldKeys[key] != null ? o.row[oldKeys[key]] : '');

  /** ค่าที่พบบ่อยที่สุดในไฟล์เก่า ใช้เป็น default */
  function mode(key, fallback) {
    const counts = new Map();
    for (const o of oldRows) {
      const v = String(cell(o, key) ?? '').trim();
      if (v) counts.set(v, (counts.get(v) || 0) + 1);
    }
    let best = fallback, n = 0;
    for (const [v, c] of counts) if (c > n) { n = c; best = v; }
    return best;
  }

  /** ค่าที่พบบ่อยสุดจากไฟล์ Lazada/TikTok */
  function specMode(field, fallback) {
    if (!specs) return fallback;
    const counts = new Map();
    for (const d of specs.data) {
      const v = String(d[field] ?? '').trim();
      if (v) counts.set(v, (counts.get(v) || 0) + 1);
    }
    let best = fallback, n = 0;
    for (const [v, c] of counts) if (c > n) { n = c; best = v; }
    return best;
  }

  const defWeight = specs ? specMode('weight', DEFAULTS.weight) : mode('ps_weight', DEFAULTS.weight);
  const defLength = specs ? specMode('length', DEFAULTS.length) : mode('ps_length', DEFAULTS.length);
  const defWidth = specs ? specMode('width', DEFAULTS.width) : mode('ps_width', DEFAULTS.width);
  const defHeight = specs ? specMode('height', DEFAULTS.height) : mode('ps_height', DEFAULTS.height);
  if (specs) console.log(`  → ค่าเริ่มต้นจากไฟล์เก่า: น้ำหนัก ${defWeight} · ${defLength}×${defWidth}×${defHeight}`);
  const defChannels = Object.fromEntries(channelCols.map(k => [k, mode(k, '')]));

  // ── เตรียมเทมเพลต ──
  const tpl = readForm(templateFile);
  const K = tpl.keys;
  const need = ['ps_product_name', 'ps_price', 'ps_item_cover_image'];
  const missing = need.filter(k => K[k] == null);
  if (missing.length) { console.error(`✖ เทมเพลตขาดคอลัมน์: ${missing.join(', ')}`); process.exit(1); }

  const imageCols = [K.ps_item_cover_image, ...Array.from({ length: 8 }, (_, i) => K[`ps_item_image_${i + 1}`])];
  const maxCol = Math.max(...Object.values(K));

  // ── ค่า override ที่กรอกเอง (templates/shopee-overrides.csv) ──
  // คอลัมน์: Code,ราคา,รายละเอียด,SKU,สต็อก,น้ำหนัก
  const overrides = {};
  const ovPath = path.join(OUT_DIR, 'shopee-overrides.csv');
  if (fs.existsSync(ovPath)) {
    const wb2 = XLSX.read(fs.readFileSync(ovPath), { type: 'buffer', raw: true });
    for (const r of XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { defval: '' })) {
      const code = String(r.Code ?? r.code ?? '').padStart(2, '0');
      if (code) overrides[code] = r;
    }
    console.log(`  → shopee-overrides.csv: ${Object.keys(overrides).length} รายการ`);
  }

  // ── รายละเอียดสินค้าที่เขียนใหม่ (templates/shopee-descriptions.csv) ──
  const descs = {};
  const descPath = path.join(OUT_DIR, 'shopee-descriptions.csv');
  if (fs.existsSync(descPath)) {
    const wb3 = XLSX.read(fs.readFileSync(descPath), { type: 'buffer', raw: true });
    for (const r of XLSX.utils.sheet_to_json(wb3.Sheets[wb3.SheetNames[0]], { defval: '' })) {
      const code = String(r.Code ?? r.code ?? '').padStart(2, '0');
      if (code) descs[code] = r;
    }
    console.log(`  → shopee-descriptions.csv: ${Object.keys(descs).length} รายการ`);
  } else {
    console.warn('  ⚠ ยังไม่มี shopee-descriptions.csv — รัน node scripts/generate-shopee-descriptions.js --apply');
  }

  console.log('\n── จับคู่สินค้า ──');
  const MATCH_MIN = parseFloat(arg('--min') || '0.50');

  // หาคอลัมน์คุณลักษณะจากหัวตารางภาษาไทย (แถว 3)
  const attrCols = [];
  for (const a of CONFIG.attributes) {
    const c = (tpl.rows[2] || []).findIndex(v => a.match.test(String(v ?? '')));
    if (c >= 0) attrCols.push({ ...a, col: c, label: String(tpl.rows[2][c]) });
  }
  console.log(attrCols.length
    ? `  → คอลัมน์คุณลักษณะที่เจอ: ${attrCols.map(a => a.label).join(', ')}`
    : '  ⚠ เทมเพลตนี้ไม่มีคอลัมน์คุณลักษณะ (ต้องดาวน์โหลดเทมเพลตแบบเลือกหมวดหมู่แล้ว)');

  // ── หาเลข ID ของหมวดหมู่ ──
  let categoryId = CONFIG.categoryId;
  if (!categoryId && CONFIG.category) {
    const hit = resolveCategoryId(tpl.wb, CONFIG.category);
    if (hit) {
      categoryId = hit.id;
      console.log(`  → หมวดหมู่: ${hit.name} → ID ${hit.id}`);
      if (hit.ambiguous) {
        console.log('    (เจอหลายอัน เลือกอันที่ใกล้สุด — ถ้าผิดใส่ CONFIG.categoryId เอง)');
        hit.ambiguous.forEach(a => console.log(`      ${a.id}  ${a.name}`));
      }
    } else {
      console.warn(`  ⚠ ค้นเลข ID ของ "${CONFIG.category}" ไม่เจอ — ตั้ง CONFIG.categoryId เอง`);
    }
  }
  const outRows = [];
  const report = [['Code', 'ชื่อจากโฟลเดอร์', 'จับคู่ products.json', 'คะแนน', 'ราคา', 'น้ำหนัก', 'จำนวนรูป']];
  let matched = 0, unmatched = 0;

  for (const p of catalog) {
    const row = new Array(maxCol + 1).fill('');

    const ov = overrides[p.code] || {};
    const { match: prod, score } = bestMatch(p.title, products);
    const good = score >= MATCH_MIN;
    if (good) matched++; else unmatched++;

    const { match: old, score: oldScore } = bestMatch(p.title, oldRows);
    const oldGood = oldScore >= MATCH_MIN ? old : null;

    // สเปกพัสดุจากไฟล์ Lazada/TikTok (ถ้ามี)
    const { match: sp, score: spScore } = specs ? bestMatch(p.title, specs.data) : { match: null, score: 0 };
    const spGood = spScore >= MATCH_MIN ? sp : null;

    // ลำดับความสำคัญ: override → products.json → ไฟล์ Shopee เก่า → ไฟล์ Lazada/TikTok → ค่าเริ่มต้น
    const notEmpty = (v) => v != null && String(v).trim() !== '';
    const pick = (ovKey, fromProd, fromOldKey, specField, fallback) =>
      notEmpty(ov[ovKey]) ? ov[ovKey]
        : (good && notEmpty(fromProd)) ? fromProd
          : (oldGood && fromOldKey && notEmpty(cell(oldGood, fromOldKey))) ? cell(oldGood, fromOldKey)
            : (spGood && specField && notEmpty(spGood[specField])) ? spGood[specField]
              : fallback;

    const D = descs[p.code] || {};

    const name = String(pick('ชื่อสินค้า', good ? prod.name : '', 'ps_product_name', 'name', p.title)).slice(0, 120);
    const price = notEmpty(ov['ราคา']) ? ov['ราคา']
      : (CONFIG.price != null ? CONFIG.price : pick('ราคา', good ? prod.price : '', 'ps_price', 'price', ''));
    const stock = pick('สต็อก', good ? prod.stock : '', 'ps_stock', 'stock', DEFAULTS.stock);
    const sku = pick('SKU', good ? prod.sku : '', 'ps_sku_short', 'sku', `BT-${p.code}`);

    // รายละเอียด: override → ไฟล์ descriptions ที่เขียนใหม่ → products.json → ไฟล์เก่า
    const desc = notEmpty(ov['รายละเอียด']) ? String(ov['รายละเอียด'])
      : notEmpty(D['รายละเอียด']) ? String(D['รายละเอียด'])
        : good ? htmlToText(prod.description)
          : oldGood && notEmpty(cell(oldGood, 'ps_product_description')) ? String(cell(oldGood, 'ps_product_description'))
            : spGood ? htmlToText(spGood.desc) : '';

    row[K.ps_product_name] = name;
    if (K.ps_product_description != null) row[K.ps_product_description] = desc;
    if (K.ps_sku_parent_short != null) row[K.ps_sku_parent_short] = `BT-${p.code}`;
    if (K.ps_sku_short != null) row[K.ps_sku_short] = sku;
    row[K.ps_price] = price;
    if (K.ps_stock != null) row[K.ps_stock] = stock;

    // รูป: ภาพปก + รูปภาพ 1-8
    p.images.slice(0, 9).forEach((url, i) => { if (imageCols[i] != null) row[imageCols[i]] = url; });

    // น้ำหนัก / ขนาด
    const spec = (f, fromOldKey, def) =>
      (spGood && String(spGood[f] ?? '').trim()) ? spGood[f]
        : (oldGood && cell(oldGood, fromOldKey) !== '') ? cell(oldGood, fromOldKey)
          : def;

    if (K.ps_weight != null) row[K.ps_weight] = ov['น้ำหนัก'] || spec('weight', 'ps_weight', defWeight);
    if (K.ps_length != null) row[K.ps_length] = spec('length', 'ps_length', defLength);
    if (K.ps_width != null) row[K.ps_width] = spec('width', 'ps_width', defWidth);
    if (K.ps_height != null) row[K.ps_height] = spec('height', 'ps_height', defHeight);

    // หมวดหมู่ + แบรนด์
    if (K.ps_category != null && categoryId) row[K.ps_category] = Number(categoryId);
    if (K.ps_brand != null && CONFIG.brand) row[K.ps_brand] = CONFIG.brand;

    // ช่องทางขนส่ง — ตาม CONFIG.channels (ถ้าไฟล์เก่ามีค่าอยู่แล้วให้ใช้ของเดิม)
    for (const k of Object.keys(K)) {
      if (!k.startsWith('channel_id')) continue;
      const fromOld = oldGood ? cell(oldGood, k) : '';
      row[K[k]] = notEmpty(fromOld) ? fromOld
        : (k in CONFIG.channels) ? (CONFIG.channels[k] ? CONFIG.channelOn : CONFIG.channelOff)
          : (defChannels[k] || '');
    }

    // คุณลักษณะสินค้า
    for (const a of attrCols) {
      row[a.col] = a.value != null ? a.value
        : (D['ความจุ'] || (String(name).match(/(\d+)\s*GB/i) ? `${name.match(/(\d+)\s*GB/i)[1]}GB` : '4GB'));
    }

    outRows.push(row);
    report.push([p.code, p.title, good ? prod.name : '— ไม่พบ —', score.toFixed(2), price, row[K.ps_weight] ?? '', p.images.length]);
    console.log(`  ${p.code}  ${good ? '✓' : '✗'} ${score.toFixed(2)}  ฿${price || '?'}  ${p.images.length} รูป  ${p.title.slice(0, 40)}`);
  }

  console.log(`\nจับคู่ได้ ${matched}/${catalog.length} · ไม่พบ ${unmatched}`);

  if (!APPLY) {
    console.log('\n(dry run — ใส่ --apply เพื่อเขียนไฟล์)');
    return;
  }

  // ── เขียนผลลัพธ์ ──
  fs.mkdirSync(OUT_DIR, { recursive: true });
  XLSX.utils.sheet_add_aoa(tpl.ws, outRows, { origin: { r: HEADER_ROWS, c: 0 } });

  const outFile = path.join(OUT_DIR, CODE ? `shopee-upload-${CODE}.xlsx` : 'shopee-upload-filled.xlsx');
  XLSX.writeFile(tpl.wb, outFile, { bookType: 'xlsx' });

  const csv = '\uFEFF' + report.map(r => r.map(v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\r\n');
  fs.writeFileSync(path.join(OUT_DIR, 'shopee-fill-report.csv'), csv, 'utf8');

  // ถ้ายังไม่มีไฟล์ override ให้สร้างโครงพร้อมรายการที่จับคู่ไม่ได้
  if (!CODE && !fs.existsSync(ovPath)) {
    const head = ['Code', 'ชื่อสินค้า', 'ราคา', 'สต็อก', 'SKU', 'น้ำหนัก', 'รายละเอียด'];
    const miss = report.slice(1).filter(r => r[2] === '— ไม่พบ —')
      .map(r => [r[0], r[1], '', '', '', '', '']);
    const c = '﻿' + [head, ...miss].map(r => r.map(v => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\r\n');
    fs.writeFileSync(ovPath, c, 'utf8');
    console.log(`\n✔ templates/shopee-overrides.csv  (${miss.length} รายการที่ต้องกรอกเอง — กรอกแล้วรันซ้ำ)`);
  }

  console.log(`\n✔ ${path.relative(ROOT, outFile)}  (${outRows.length} รายการ)`);
  console.log('✔ templates/shopee-fill-report.csv     (ตรวจว่าจับคู่ถูกไหม)');
  console.log('\n⚠ เปิดเช็คก่อนอัป: หมวดหมู่สินค้า (คอลัมน์ A) และช่องทางขนส่ง ถ้ายังว่างต้องเลือกในไฟล์เอง');
})().catch(e => { console.error('✖', e); process.exit(1); });
