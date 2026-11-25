/**
 * ต้นทุนแฟลชไดร์ฟต่อชิ้น แยกตามความจุ (บาท) — ตัวเลขจากเจ้าของร้าน
 * ยังไม่รวม: ค่าส่งที่ร้านจ่าย, กล่อง/ปก/แพ็ก, ค่าธรรมเนียมชำระเงินเว็บ (ยังไม่ทราบตัวเลข)
 * ใช้ที่เดียวทั้งแท็บสรุปการเงิน — แก้ราคาทุนที่นี่
 */
const UNIT_COST = { '512MB': 37, '1GB': 47, '2GB': 50, '4GB': 55, '16GB': 76 };
const FALLBACK_COST = 55; // ความจุที่ไม่อยู่ในตาราง/ไม่รู้ → ใช้ราคาทุน 4GB (ขายดีสุด)

function normCap(c) {
  return String(c || '').toUpperCase().replace(/\s+/g, '');
}

/** ต้นทุนต่อชิ้นจากความจุ เช่น "4GB" → 55 · อุปกรณ์เสริม/ไม่รู้ความจุ → { cost, known:false } */
function costOf(capacity) {
  const k = normCap(capacity);
  if (k in UNIT_COST) return { cost: UNIT_COST[k], known: true };
  return { cost: FALLBACK_COST, known: false };
}

module.exports = { UNIT_COST, FALLBACK_COST, costOf };
