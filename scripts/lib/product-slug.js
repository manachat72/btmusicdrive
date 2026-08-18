/**
 * slugify ภาษาไทย → โรมัน สำหรับ Node scripts
 *
 * ไม่ hardcode ตารางซ้ำ — อ่าน WORD_REPLACEMENTS + THAI_CHAR_MAP จาก
 * server/src/lib/productSlug.ts โดยตรง เพื่อให้ slug ที่ studio คำนวณ
 * ตรงกับที่ backend สร้างเสมอ (แก้ที่เดียว)
 */
const fs = require('fs');
const path = require('path');

const TS_FILE = path.resolve(__dirname, '..', '..', 'server', 'src', 'lib', 'productSlug.ts');
const MAX_SLUG_LEN = 96;

function loadMaps() {
  const src = fs.readFileSync(TS_FILE, 'utf8');

  const wordBlock = src.slice(
    src.indexOf('WORD_REPLACEMENTS'),
    src.indexOf('THAI_CHAR_MAP')
  );
  const words = [];
  for (const m of wordBlock.matchAll(/\[\/(.+?)\/g,\s*'(.*?)'\]/g)) {
    words.push([new RegExp(m[1], 'g'), m[2]]);
  }

  const charBlock = src.slice(src.indexOf('THAI_CHAR_MAP'));
  const chars = {};
  for (const m of charBlock.matchAll(/'(.)':\s*'(.*?)'/g)) chars[m[1]] = m[2];

  if (!words.length || !Object.keys(chars).length) {
    throw new Error('อ่านตาราง slug จาก productSlug.ts ไม่ได้ — เช็คว่าไฟล์ยังมี WORD_REPLACEMENTS / THAI_CHAR_MAP');
  }
  return { words, chars };
}

const { words: WORD_REPLACEMENTS, chars: THAI_CHAR_MAP } = loadMaps();

function transliterateThai(input) {
  let text = String(input || '').normalize('NFKC');
  for (const [re, rep] of WORD_REPLACEMENTS) text = text.replace(re, rep);
  return Array.from(text).map(c => (c in THAI_CHAR_MAP ? THAI_CHAR_MAP[c] : c)).join('');
}

/** ให้ผลเหมือน slugifyProductText() ฝั่ง server */
function slugify(value) {
  return transliterateThai(value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, MAX_SLUG_LEN)
    .replace(/^-+|-+$/g, '');
}

/** slug สำหรับโฟลเดอร์รูป — สั้นกว่า slug สินค้า อ่านง่ายกว่าใน URL รูป */
function imageSlug(value, max = 60) {
  return slugify(value).slice(0, max).replace(/-+$/g, '') || 'product';
}

/** ทำให้ไม่ชนกับโฟลเดอร์รูปที่มีอยู่แล้ว (เว้นตัวที่เป็นของสินค้าเดิมเอง) */
function uniqueImageSlug(base, existingDirs, allowSelf = null) {
  let cand = base, i = 2;
  while (existingDirs.includes(cand) && cand !== allowSelf) cand = `${base}-${i++}`;
  return cand;
}

module.exports = { slugify, imageSlug, uniqueImageSlug, transliterateThai };
