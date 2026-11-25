/**
 * ตารางต้นทุนสินค้า + คำแนะนำ "ควรขึ้น / ควรลด" (แท็บ "ต้นทุนสินค้า" ใน Studio) — อ่านอย่างเดียว ไม่แก้ราคาใน DB
 * ราคาทุนอยู่ที่ unit-costs.js (ที่เดียว) · ต้นทุน repo นี้ public → ห้ามส่งออกไปหน้าเว็บ/products.json
 *
 * กติกาคำแนะนำ (ปรับเกณฑ์ได้ด้วย ?floor=&days=):
 *  - ขึ้น: กำไร % ต่ำกว่าเกณฑ์ขั้นต่ำ หรือ ขายดี (ตั้งแต่ 3 ชิ้น และมากกว่าค่ากลางของความจุเดียวกัน) แต่ราคาต่ำกว่าค่ากลางของความจุนั้น
 *  - ลด: ไม่มียอดขายเลยในช่วงที่ดู และราคาสูงกว่าค่ากลางของความจุเดียวกัน → เสนอลงมาที่ค่ากลาง (ไม่ต่ำกว่าราคาที่กำไร % ยังเท่าเกณฑ์ขั้นต่ำ)
 *  - ที่เหลือ: คงราคา
 */
const { costOf } = require('./unit-costs');
const { capacityFromSpecs } = require('./sku');
const { db, SOLD } = require('./finance-summary');

const median = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const round9 = (n) => Math.max(9, Math.round(n / 10) * 10 - 1); // ราคาลงท้าย 9 เหมือนที่ร้านตั้ง (199, 289)

async function summary(q) {
  const days = Math.min(Math.max(parseInt(q.get('days'), 10) || 90, 7), 730);
  const floor = Math.min(Math.max(Number(q.get('floor')) || 60, 10), 95); // กำไรขั้นต่ำ %
  const since = new Date(Date.now() - days * 864e5);

  const [prods, items] = await Promise.all([
    db().product.findMany({ where: { isActive: true }, select: { id: true, name: true, sku: true, slug: true, price: true, originalPrice: true, specs: true, imageUrl: true } }),
    db().orderItem.findMany({ where: { order: { status: { in: SOLD }, createdAt: { gte: since } } }, select: { productId: true, quantity: true } }),
  ]);
  const sold = {};
  for (const i of items) sold[i.productId] = (sold[i.productId] || 0) + (Number(i.quantity) || 1);

  const rows = prods.map((p) => {
    const cap = capacityFromSpecs(p.specs) || ((String(p.name).match(/(\d+)\s*(GB|MB)/i) || []).slice(1).join('')) || '?';
    // อุปกรณ์เสริม (SKU BT-AC-…) ไม่ใช่แฟลชไดร์ฟ → ราคาทุนตามความจุใช้ไม่ได้ (ต้องให้ร้านระบุทีละชิ้น)
    const accessory = /^BT-AC-/i.test(p.sku || '');
    const c = accessory ? { cost: 0, known: false } : costOf(cap), price = Number(p.price) || 0;
    return { id: p.id, sku: p.sku || '', name: p.name, slug: p.slug || '', image: p.imageUrl || '', cap: accessory ? 'อุปกรณ์เสริม' : cap, accessory, price, listPrice: Number(p.originalPrice) || 0, cost: c.cost, costKnown: c.known,
      profit: accessory ? 0 : price - c.cost, margin: accessory ? 0 : (price ? (price - c.cost) / price * 100 : 0), sold: sold[p.id] || 0 };
  });

  const byCap = {};
  for (const r of rows) (byCap[r.cap] ||= []).push(r);
  const stat = {};
  for (const [cap, list] of Object.entries(byCap)) stat[cap] = { n: list.length, price: median(list.map((r) => r.price)), sold: median(list.map((r) => r.sold)) };

  for (const r of rows) {
    const g = stat[r.cap], minPrice = r.cost / (1 - floor / 100); // ราคาต่ำสุดที่กำไรยังถึงเกณฑ์
    r.groupPrice = g.price;
    r.action = 'hold'; r.suggest = r.price; r.reason = 'ราคาอยู่ในระดับเดียวกับความจุเดียวกัน';
    if (r.accessory) { r.reason = 'อุปกรณ์เสริม — ยังไม่มีราคาทุน (ใส่ใน unit-costs.js ได้)'; continue; }
    if (r.margin < floor) {
      r.action = 'up'; r.suggest = round9(Math.max(minPrice, g.price)); r.reason = `กำไร ${r.margin.toFixed(0)}% ต่ำกว่าเกณฑ์ ${floor}%`;
    } else if (r.sold >= 3 && r.sold > g.sold && r.price < g.price) {
      r.action = 'up'; r.suggest = round9(Math.min(g.price, r.price + 30)); r.reason = `ขายดี (${r.sold} ชิ้น) แต่ราคาต่ำกว่าค่ากลาง ${r.cap} (฿${g.price})`;
    } else if (r.sold === 0 && r.price > g.price) {
      r.action = 'down'; r.suggest = round9(Math.max(g.price, minPrice)); r.reason = `ไม่มียอดขายใน ${days} วัน และแพงกว่าค่ากลาง ${r.cap} (฿${g.price})`;
    }
    if (r.suggest === r.price) { r.action = 'hold'; if (r.reason !== 'ราคาอยู่ในระดับเดียวกับความจุเดียวกัน') r.reason += ' (ราคาแนะนำเท่าเดิมอยู่แล้ว)'; }
  }
  rows.sort((a, b) => String(a.sku).localeCompare(String(b.sku)));
  return { days, floor, generatedAt: new Date().toISOString(), groups: stat, rows,
    counts: { up: rows.filter((r) => r.action === 'up').length, down: rows.filter((r) => r.action === 'down').length, hold: rows.filter((r) => r.action === 'hold').length } };
}

module.exports = { summary };
