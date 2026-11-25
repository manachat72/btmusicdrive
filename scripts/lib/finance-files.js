/**
 * สรุปการเงินจากไฟล์ export ของ TikTok (โฟลเดอร์อยู่ใน .gitignore — ข้อมูลยอดขาย repo นี้ public)
 *  tiktok-daily-sales-export/  ← Seller Center > การเงิน > รายได้ > export (income_*.xlsx)
 *      ชีต "รายงาน" = ยอดสรุปทั้งช่วง (เงินเข้าจริงหลังหักค่าธรรมเนียม) · "รายละเอียดคำสั่งซื้อ" = ทีละออเดอร์
 *  tiktok-daily-ads-spend/     ← Ads Manager > GMV Max > export รายวันต่อแคมเปญ (.xlsx/.csv)
 * วางหลายไฟล์ได้: รายได้ใช้ไฟล์ล่าสุดเป็นยอดสรุป + รวมรายละเอียดทุกไฟล์ (กันซ้ำด้วยเลขคำสั่งซื้อ)
 *                 โฆษณารวมทุกไฟล์ กันซ้ำด้วย แคมเปญ+วัน (ไฟล์ใหม่กว่าชนะ)
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..', '..');
const SALES_DIR = path.join(ROOT, 'tiktok-daily-sales-export');
const ADS_DIR = path.join(ROOT, 'tiktok-daily-ads-spend');
const n = (v) => { const x = Number(String(v).replace(/,/g, '')); return Number.isFinite(x) ? x : 0; };
const day = (v) => String(v || '').trim().slice(0, 10).replace(/\//g, '-');

function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /\.(xlsx|xls|csv)$/i.test(f) && !f.startsWith('.~lock') && !f.startsWith('~$'))
    .map((f) => ({ f, p: path.join(dir, f), t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => a.t - b.t);
}
const rows = (ws) => XLSX.utils.sheet_to_json(ws, { defval: '' });

// ── รายได้ TikTok Shop ──
function readSales() {
  const list = files(SALES_DIR);
  if (!list.length) return null;
  let report = null; const orders = new Map();
  for (const { f, p } of list) {
    const wb = XLSX.readFile(p);
    const rep = wb.Sheets['รายงาน'];
    if (rep) {
      const lines = XLSX.utils.sheet_to_json(rep, { header: 1, defval: '' }).map((r) => r.filter((v) => v !== '')).filter((r) => r.length >= 2);
      const kv = {}; for (const [k, v] of lines) kv[String(k).trim()] = v;
      const [from, to] = String(kv['ช่วงเวลา'] || '').split('-').map(day);
      report = { file: f, from, to, kv, lines: lines.filter((r) => r[0] !== 'ช่วงเวลา' && r[0] !== 'เขตเวลา' && r[0] !== 'สกุลเงิน').map(([k, v]) => ({ k: String(k), v: n(v) })) };
    }
    const det = wb.Sheets['รายละเอียดคำสั่งซื้อ'];
    if (det) for (const r of rows(det)) {
      const id = String(r['หมายเลขคำสั่งซื้อ/การปรับ'] || '');
      if (!id) continue;
      orders.set(id + '|' + r['ประเภทธุรกรรม'], { id, type: r['ประเภทธุรกรรม'], created: day(r['เวลาที่สร้างคำสั่งซื้อ']), paid: day(r['เวลาที่ชำระคำสั่งซื้อ']),
        payout: n(r['ยอดการชำระเงินทั้งหมด']), revenue: n(r['รายได้ทั้งหมด']), fees: n(r['ค่าธรรมเนียมทั้งหมด']) });
    }
  }
  return { report, orders: [...orders.values()], files: list.map((x) => x.f) };
}

// ── ค่าโฆษณา GMV Max รายวันต่อแคมเปญ ──
function readAds() {
  const list = files(ADS_DIR);
  if (!list.length) return null;
  const m = new Map();
  for (const { p } of list) {
    const wb = XLSX.readFile(p);
    for (const r of rows(wb.Sheets[wb.SheetNames[0]])) {
      const date = day(r['ตามวัน'] || r['วันที่'] || r['Date'] || r['By Day']);
      const id = String(r['ID แคมเปญ'] || r['Campaign ID'] || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !id) continue;
      m.set(id + '|' + date, { id, date, name: r['ชื่อแคมเปญ'] || r['Campaign name'] || id,
        cost: n(r['ต้นทุน'] ?? r['Cost']), revenue: n(r['รายได้ขั้นต้น'] ?? r['Gross revenue']),
        orders: n(r['คำสั่งซื้อ SKU'] ?? r['SKU orders']), affiliate: n(r['ค่าใช้จ่าย (แอฟฟิลิเอต)']), budget: n(r['งบประมาณปัจจุบัน']) });
    }
  }
  return { rows: [...m.values()], files: list.map((x) => x.f) };
}

function summary(q) {
  const sales = readSales(), ads = readAds();
  if (!sales && !ads) return { empty: true, dirs: [SALES_DIR, ADS_DIR] };
  const rep = sales && sales.report;
  const allDates = ads ? ads.rows.map((r) => r.date).sort() : [];
  // ช่วงเริ่มต้น = ช่วงของรายงานรายได้ (ให้เทียบเงินเข้ากับค่าโฆษณาช่วงเดียวกัน) · เลือกเองได้ด้วย ?from&to
  const from = q.get('from') || (rep && rep.from) || allDates[0];
  const to = q.get('to') || (rep && rep.to) || allDates[allDates.length - 1];
  const inR = (d) => d >= from && d <= to;

  const adRows = ads ? ads.rows.filter((r) => inR(r.date)) : [];
  const byDay = {}, byCamp = {};
  for (const r of adRows) {
    const d = byDay[r.date] ||= { date: r.date, cost: 0, revenue: 0, orders: 0, payout: 0, payoutOrders: 0 };
    d.cost += r.cost; d.revenue += r.revenue; d.orders += r.orders;
    const c = byCamp[r.id] ||= { id: r.id, name: r.name, cost: 0, revenue: 0, orders: 0, affiliate: 0, days: 0, last: '' };
    c.cost += r.cost; c.revenue += r.revenue; c.orders += r.orders; c.affiliate += r.affiliate; if (r.cost) c.days++;
    if (r.date > c.last) { c.last = r.date; c.name = r.name; }
  }
  const orders = sales ? sales.orders.filter((o) => inR(o.paid)) : [];
  for (const o of orders) { const d = byDay[o.paid] ||= { date: o.paid, cost: 0, revenue: 0, orders: 0, payout: 0, payoutOrders: 0 }; d.payout += o.payout; d.payoutOrders++; }
  for (let t = new Date(from + 'T00:00:00Z'); t <= new Date(to + 'T00:00:00Z'); t = new Date(t.getTime() + 864e5)) {
    const k = t.toISOString().slice(0, 10); byDay[k] ||= { date: k, cost: 0, revenue: 0, orders: 0, payout: 0, payoutOrders: 0 };
  }
  const sum = (a, k) => a.reduce((s, x) => s + x[k], 0);
  const adCost = sum(adRows, 'cost');

  let money = null;
  if (rep) {
    const kv = (k) => n(rep.kv[k]);
    const paidFromGmv = -kv('การชำระเงินด้วย GMV สำหรับโฆษณา TikTok'); // ค่าโฆษณาที่ TikTok หักจากยอดขายไปแล้ว
    const payout = kv('ยอดการชำระเงินทั้งหมด');
    const sameRange = rep.from === from && rep.to === to;
    money = { sameRange, payout, revenue: kv('รายได้ทั้งหมด'), gross: kv('ยอดรวมค่าสินค้าก่อนหักส่วนลด'), sellerDiscount: kv('ส่วนลดจากร้านค้า'),
      refunds: kv('ยอดรวมเงินคืนหลังหักส่วนลดจากผู้ขาย'), fees: kv('ค่าธรรมเนียมทั้งหมด'), adjustments: kv('การปรับยอด'), paidFromGmv,
      // ค่าโฆษณาส่วนที่ไม่ได้หักจากยอดขาย = จ่ายเพิ่มเอง (บัตร/เติมเงิน) → หักออกอีกทีถึงจะเป็นเงินเหลือจริง
      adOutOfPocket: sameRange ? Math.max(0, adCost - paidFromGmv) : null,
      feeLines: rep.lines.filter((l) => l.v !== 0) };
    if (sameRange) money.netAfterAds = payout - money.adOutOfPocket;
  }

  return {
    range: { from, to, reportFrom: rep && rep.from, reportTo: rep && rep.to, adsFrom: allDates[0], adsTo: allDates[allDates.length - 1] },
    files: { sales: sales ? sales.files : [], ads: ads ? ads.files : [] },
    money,
    ads: { cost: adCost, revenue: sum(adRows, 'revenue'), orders: sum(adRows, 'orders'), affiliate: sum(adRows, 'affiliate') },
    orderDetails: orders.length,
    daily: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
    campaigns: Object.values(byCamp).filter((c) => c.cost || c.revenue).sort((a, b) => b.cost - a.cost),
  };
}

module.exports = { summary, SALES_DIR, ADS_DIR };
