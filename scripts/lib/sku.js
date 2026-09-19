'use strict';

/**
 * SKU กลางของร้าน — รูปแบบ  BT-<หมวด>-<ความจุ>-<เลขชุด>
 *
 *   BT-LT-08-045  =  ลูกทุ่ง · 8GB · ชุดที่ 045
 *
 * เลขชุด = เลขโฟลเดอร์บน NAS ซึ่งเป็นเลขชุดเดียวกันทั้ง
 *   Z:\music\045. …            (ไฟล์เพลง MP3 จริง)
 *   Z:\photos\Product\45-…      (รูปสินค้า)
 *   Z:\photos\epson-print\ภาพ_named\045. … .png   (ไฟล์ปกที่ปริ้น)
 * ⚠ ไม่ใช่ code marketplace ใน catalog.json / R2 products/<code>/ ซึ่งเป็นเลขชุดเก่าคนละชุด
 *
 * ห้ามแก้ตารางรหัสหมวดที่ใช้ไปแล้ว — SKU ที่พิมพ์/ส่งขึ้นร้านค้าไปแล้วจะไม่ตรง
 */

/** ชื่อหมวด (ตรงกับ CATEGORIES ใน seo.js) → รหัส 2 ตัว */
const CATEGORY_CODES = {
  'เพื่อชีวิต': 'PC',
  'เพลงสตริง': 'ST',
  'เพลงใต้': 'TA',
  'เพลงสากล': 'IN',
  'ลูกกรุง': 'LK',
  'ลูกทุ่ง': 'LT',
  'แดนซ์': 'DZ',
  'ธรรมะ': 'DM',
  'วิทยุ': 'RD',
  'อุปกรณ์เสริม': 'AC',
};

const UNKNOWN_CATEGORY = 'XX';
const UNKNOWN_CAPACITY = '00';
const SKU_RE = /^BT-([A-Z]{2})-([0-9A-Z]{2})-(\d{3})$/;

/** ชื่อหมวด → รหัส (ไม่รู้จัก = XX) */
function categoryCode(categoryName) {
  const name = String(categoryName || '').trim();
  return CATEGORY_CODES[name] || UNKNOWN_CATEGORY;
}

/**
 * ความจุ → รหัส 2 ตัว  "4GB"→"04" · "16GB"→"16" · "1TB"→"T1" · "512MB"→"M5" · ไม่มี→"00"
 * รับได้ทั้ง "4GB" "4 GB" "4G" "4gb" และตัวเลขล้วน (ถือว่าเป็น GB)
 */
function capacityCode(capacity) {
  const text = String(capacity == null ? '' : capacity).toUpperCase().replace(/\s+/g, '');
  if (!text) return UNKNOWN_CAPACITY;
  const m = text.match(/(\d+(?:\.\d+)?)\s*(TB|T|GB|G|MB|M)?\b/);
  if (!m) return UNKNOWN_CAPACITY;
  const n = parseFloat(m[1]);
  const unit = (m[2] || 'G')[0];
  if (!Number.isFinite(n) || n <= 0) return UNKNOWN_CAPACITY;
  if (unit === 'T') return 'T' + Math.min(9, Math.round(n));
  if (unit === 'M') return 'M' + String(Math.round(n)).charAt(0);   // 512MB→M5 · 256MB→M2
  return String(Math.min(99, Math.round(n))).padStart(2, '0');
}

/** เลขชุด (NAS) → 3 หลัก */
function seriesCode(no) {
  const n = parseInt(String(no == null ? '' : no).match(/\d+/)?.[0] || '', 10);
  return Number.isFinite(n) && n > 0 ? String(n).padStart(3, '0') : '000';
}

/**
 * สร้าง SKU
 * @param {object} i
 * @param {string} i.categoryName ชื่อหมวดภาษาไทย
 * @param {string} i.capacity     "4GB"
 * @param {string|number} i.no    เลขโฟลเดอร์ NAS
 * @returns {string} BT-LT-08-045
 */
function buildSku({ categoryName, capacity, no } = {}) {
  const cat = categoryCode(categoryName);
  // อุปกรณ์เสริม (หัวแปลง OTG ฯลฯ) ไม่มีความจุ — ช่องความจุเป็น 00 เสมอ ถึง specs จะเผลอใส่ค่าไว้
  const cap = cat === 'AC' ? UNKNOWN_CAPACITY : capacityCode(capacity);
  return `BT-${cat}-${cap}-${seriesCode(no)}`;
}

/** แยกส่วนจาก SKU — คืน null ถ้าไม่ใช่รูปแบบใหม่ */
function parseSku(sku) {
  const m = String(sku || '').trim().toUpperCase().match(SKU_RE);
  if (!m) return null;
  const name = Object.keys(CATEGORY_CODES).find(k => CATEGORY_CODES[k] === m[1]) || null;
  return { category: m[1], categoryName: name, capacity: m[2], no: parseInt(m[3], 10), sku: m[0] };
}

const isValidSku = sku => SKU_RE.test(String(sku || '').trim());

/** ความจุจาก specs ของสินค้า (คีย์ไทย 'ความจุ' มาก่อน แล้วค่อย capacity) */
function capacityFromSpecs(specs) {
  if (!specs || typeof specs !== 'object') return '';
  return String(specs['ความจุ'] || specs.capacity || specs.Capacity || '').trim();
}

/** ความจุจากชื่อโฟลเดอร์ NAS — "045. ฮิต90 - [4GB]" → "4GB" (NAS คือต้นฉบับความจุจริง) */
function capacityFromFolderName(folderName) {
  const m = String(folderName || '').match(/\[([^\]]+)\]/);
  if (!m) return '';
  const t = m[1].toUpperCase().replace(/\s+/g, '');
  const n = t.match(/(\d+(?:\.\d+)?)/);
  if (!n) return '';
  if (/TB?\b|TB/.test(t) && !/GB/.test(t)) return `${parseFloat(n[1])}TB`;
  if (/MB|KB/.test(t)) return `${parseFloat(n[1])}MB`;        // [512KB] บน NAS ที่จริงคือ 512MB
  return `${parseFloat(n[1])}GB`;
}

/** เลขชุดจากชื่อโฟลเดอร์ NAS — "045. ฮิต90" / "45-USB…" → 45 */
function seriesFromFolderName(folderName) {
  const m = String(folderName || '').match(/^\s*(\d{1,3})/);
  return m ? parseInt(m[1], 10) : null;
}

module.exports = {
  CATEGORY_CODES, UNKNOWN_CATEGORY, UNKNOWN_CAPACITY, SKU_RE,
  categoryCode, capacityCode, seriesCode, buildSku, parseSku, isValidSku,
  capacityFromSpecs, capacityFromFolderName, seriesFromFolderName,
};
