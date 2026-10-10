/**
 * โฟลเดอร์เพลงบน NAS (Z:\music\NNN. <ชื่อชุด> [<ความจุ>]) — ไฟล์เพลงในโฟลเดอร์ = รายชื่อเพลงจริงของสินค้า
 * จับคู่กับสินค้าด้วย "เลขชุด" ท้าย SKU (BT-<หมวด>-<ความจุ>-<เลขชุด>) ซึ่งเป็นเลขเดียวกับเลขหน้าโฟลเดอร์
 * ตั้ง NAS_MUSIC_DIR ใน env ทับ path ได้
 */
const fs = require('fs');
const path = require('path');

const AUDIO = /\.(mp3|m4a|wma|wav|flac)$/i;
const byName = new Intl.Collator('en', { numeric: true }).compare;

const musicDir = () => process.env.NAS_MUSIC_DIR || 'Z:\\music';

/** เลขชุดจาก SKU — อุปกรณ์เสริม (AC) / SKU รูปแบบอื่นไม่มีโฟลเดอร์เพลง คืน null */
function setNumber(sku) {
  const m = String(sku || '').match(/^BT-(?!AC-)[A-Z]{2}-[A-Z0-9]{2}-(\d{3})$/);
  return m ? m[1] : null;
}

/** @returns {{folder:string, capacity:string|null, tracks:string[]}} โยน Error เป็นข้อความไทยถ้าหาไม่เจอ/กำกวม */
function readNasTracklist(sku, dir = musicDir()) {
  const set = setNumber(sku);
  if (!set) throw new Error(`SKU "${sku || ''}" ไม่มีเลขชุด NAS`);
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { throw new Error(`อ่าน ${dir} ไม่ได้ — NAS ไม่ได้ต่ออยู่`); }
  const hits = entries.filter(e => e.isDirectory() && e.name.startsWith(set)).map(e => e.name);
  if (hits.length !== 1) {
    throw new Error(hits.length
      ? `เลขชุด ${set} มี ${hits.length} โฟลเดอร์ใน ${dir}: ${hits.join(' · ')}`
      : `ไม่มีโฟลเดอร์เลขชุด ${set} ใน ${dir}`);
  }
  const tracks = fs.readdirSync(path.join(dir, hits[0]))
    .filter(f => AUDIO.test(f)).sort(byName).map(f => f.replace(AUDIO, ''));
  const cap = hits[0].match(/[\[(]\s*(\d+)\s*(GB|G|MB|KB)\s*[\])]/i);
  // ชื่อโฟลเดอร์พิมพ์ผิดบ่อย: [1G] = 1GB · [512KB] = 512MB
  const unit = cap && (/^G/i.test(cap[2]) ? 'GB' : 'MB');
  return { folder: hits[0], capacity: cap ? cap[1] + unit : null, tracks };
}

module.exports = { musicDir, setNumber, readNasTracklist };
