/**
 * สรุปการเงิน (แท็บ "สรุปการเงิน" ใน Product Studio) — ยอดเงินเข้า + ยอดขาย เทียบค่าโฆษณา
 *  - ออเดอร์เว็บ: อ่าน DB ตรงด้วย Prisma ของ server/ (API /orders ติด rate limit 5 ครั้ง/15 นาที)
 *  - TikTok: ค่าโฆษณา + ยอดขาย TikTok Shop ที่ TikTok นับให้โฆษณา (รวม GMV Max) ผ่าน tiktok-ads-live.overview()
 * อ่านอย่างเดียว ไม่เขียนอะไรลง DB / TikTok
 */
const fs = require('fs');
const path = require('path');
const live = require('./tiktok-ads-live');
const { costOf, FALLBACK_COST } = require('./unit-costs');
const { capacityFromSpecs } = require('./sku');

const SERVER = path.resolve(__dirname, '..', '..', 'server');
const SOLD = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
const TZ = 'Asia/Bangkok';
const ymd = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });

function ensureDbUrl() {
  if (process.env.DATABASE_URL) return;
  for (const f of ['.env.local', '.env']) {
    try {
      const m = fs.readFileSync(path.join(SERVER, f), 'utf8').match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
      if (m) { process.env.DATABASE_URL = m[1]; return; }
    } catch { /* ไม่มีไฟล์ */ }
  }
}

let prisma = null;
function db() {
  if (prisma) return prisma;
  ensureDbUrl();
  const { PrismaClient } = require(path.join(SERVER, 'node_modules', '@prisma', 'client'));
  prisma = new PrismaClient();
  return prisma;
}

async function webOrders(start, end) {
  const rows = await db().order.findMany({
    where: { status: { in: SOLD }, createdAt: { gte: new Date(start + 'T00:00:00+07:00'), lte: new Date(end + 'T23:59:59.999+07:00') } },
    select: { createdAt: true, totalAmount: true, discountAmount: true, paymentIntentId: true, status: true,
      items: { select: { quantity: true, product: { select: { specs: true, name: true } } } } },
  });
  // COD ก็มี paymentIntentId (ขึ้นต้น cod_) · บัตร/พร้อมเพย์ผ่าน Stripe ขึ้นต้น pi_
  return rows.map((o) => {
    // ต้นทุนสินค้า = Σ จำนวน × ราคาทุนตามความจุ (ความจุจาก specs ของสินค้า ไม่มีก็ดูจากชื่อ)
    let cost = 0, units = 0, unknown = 0;
    for (const it of o.items || []) {
      const cap = capacityFromSpecs(it.product && it.product.specs) || ((String(it.product && it.product.name || '').match(/(\d+)\s*(GB|MB)/i) || []).slice(1).join(''));
      const c = costOf(cap), q = Number(it.quantity) || 1;
      cost += c.cost * q; units += q; if (!c.known) unknown += q;
    }
    return { date: ymd(o.createdAt), total: Number(o.totalAmount) || 0, discount: Number(o.discountAmount) || 0,
      cod: String(o.paymentIntentId || '').startsWith('cod_'), delivered: o.status === 'DELIVERED', cost, units, unknown };
  });
}

async function tiktok(start) {
  const days = Math.round((new Date(ymd(Date.now())) - new Date(start)) / 864e5) + 1;
  const out = [];
  for (const adv of live.ADV_IDS) out.push(await live.overview(adv, new URLSearchParams({ days: String(days) })));
  return out;
}

function rangeOf(q) {
  const today = ymd(Date.now());
  const p = q.get('period') || '30';
  const back = (n) => ymd(Date.now() - (n - 1) * 864e5);
  const [y, m] = today.split('-').map(Number);
  const pad = (n) => String(n).padStart(2, '0');
  if (p === 'month') return { start: `${y}-${pad(m)}-01`, end: today, label: 'เดือนนี้' };
  if (p === 'lastmonth') {
    const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
    const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
    return { start: `${py}-${pad(pm)}-01`, end: `${py}-${pad(pm)}-${pad(last)}`, label: 'เดือนก่อน' };
  }
  if (p === 'year') return { start: `${y}-01-01`, end: today, label: 'ปีนี้' };
  const n = Math.min(Math.max(parseInt(p, 10) || 30, 1), 730);
  return { start: back(n), end: today, label: `${n} วันล่าสุด` };
}

const cache = new Map(); // period → { at, data } เก็บ 5 นาที (TikTok ดึงนาน)

async function summary(q) {
  const r = rangeOf(q);
  const key = r.start + '_' + r.end;
  const hit = cache.get(key);
  if (hit && !q.get('fresh') && Date.now() - hit.at < 5 * 60e3) return hit.data;

  const errors = {};
  const day = {};
  const D = (d) => (day[d] ||= { date: d, webRevenue: 0, webOrders: 0, ttRevenue: 0, ttOrders: 0, adSpend: 0, cost: 0 });
  const inRange = (d) => d >= r.start && d <= r.end;

  const [web, tt] = await Promise.all([
    webOrders(r.start, r.end).catch((e) => { errors.web = e.message; return []; }),
    (live.hasToken() ? tiktok(r.start) : Promise.reject(new Error('ไม่พบ TIKTOK_ADS_ACCESS_TOKEN ใน server/.env.local')))
      .catch((e) => { errors.tiktok = e.message; return []; }),
  ]);

  const w = { revenue: 0, orders: 0, cod: 0, codOrders: 0, card: 0, cardOrders: 0, discount: 0, cost: 0, units: 0, unknownUnits: 0 };
  for (const o of web) {
    const x = D(o.date); x.webRevenue += o.total; x.webOrders++; x.cost += o.cost;
    w.cost += o.cost; w.units += o.units; w.unknownUnits += o.unknown;
    w.revenue += o.total; w.orders++; w.discount += o.discount;
    if (o.cod) { w.cod += o.total; w.codOrders++; } else { w.card += o.total; w.cardOrders++; }
  }
  for (const acc of tt) {
    if (acc.gmvError) errors.gmvMax = acc.gmvError;
    for (const d of acc.daily || []) {
      if (!inRange(d.date)) continue;
      const x = D(d.date); x.adSpend += d.spend || 0; x.ttRevenue += d.revenue || 0; x.ttOrders += d.orders || 0;
    }
  }

  // เติมวันที่ไม่มีอะไรเลยให้กราฟต่อเนื่อง
  for (let t = new Date(r.start + 'T00:00:00Z'); t <= new Date(r.end + 'T00:00:00Z'); t = new Date(t.getTime() + 864e5)) D(t.toISOString().slice(0, 10));
  const daily = Object.values(day).filter((x) => inRange(x.date)).sort((a, b) => a.date.localeCompare(b.date));
  // TikTok ไม่บอกว่าขายความจุไหน → ประมาณต้นทุนต่อออเดอร์ = ต้นทุนเฉลี่ยต่อออเดอร์ของเว็บในช่วงเดียวกัน (ไม่มีออเดอร์เว็บ ใช้ราคาทุน 4GB)
  const perOrder = w.orders ? w.cost / w.orders : FALLBACK_COST;
  for (const x of daily) {
    x.ttCost = x.ttOrders * perOrder; x.cost += x.ttCost;
    x.income = x.webRevenue + x.ttRevenue; x.net = x.income - x.adSpend; x.profit = x.net - x.cost;
  }

  const sum = (k) => daily.reduce((a, x) => a + x[k], 0);
  const adSpend = sum('adSpend'), ttRevenue = sum('ttRevenue'), ttOrders = sum('ttOrders'), cost = sum('cost');
  const income = w.revenue + ttRevenue;
  const data = {
    range: r, generatedAt: new Date().toISOString(), errors,
    totals: { income, orders: w.orders + ttOrders, adSpend, net: income - adSpend,
      cost, ttCostEstimated: cost - w.cost, profit: income - adSpend - cost,
      roas: adSpend ? income / adSpend : 0, ttRoas: adSpend ? ttRevenue / adSpend : 0,
      adShare: income ? adSpend / income * 100 : 0, web: w, tiktok: { revenue: ttRevenue, orders: ttOrders } },
    daily,
  };
  cache.set(key, { at: Date.now(), data });
  return data;
}

module.exports = { summary, db, SOLD };
