/**
 * หา path โฟลเดอร์รูปสินค้าบน NAS — จุดเดียวที่รู้ path ห้ามฮาร์ดโค้ดซ้ำที่อื่น
 *
 * ไดรฟ์ที่ map ไว้เปลี่ยนชื่อโฟลเดอร์ได้ (เคยเป็น Z:\รูป\ ตอนนี้เป็น Z:\photos\)
 * เลยไล่ลองตามลำดับแทนที่จะยึดค่าเดียว ตั้ง NAS_DIR ใน env ทับได้เสมอ
 */
const fs = require('fs');

const CANDIDATES = [
  'Z:\\photos\\รูปสินค้า',
  'Z:\\รูป\\รูปสินค้า',
];

/** @returns {string} path ที่มีอยู่จริง — ถ้าไม่เจอเลยคืนตัวแรกไว้โชว์ใน error/log */
function nasDir() {
  if (process.env.NAS_DIR) return process.env.NAS_DIR;
  for (const p of CANDIDATES) {
    try { if (fs.existsSync(p)) return p; } catch { }
  }
  return CANDIDATES[0];
}

module.exports = { nasDir, CANDIDATES };
