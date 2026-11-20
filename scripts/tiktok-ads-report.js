// Pull TikTok Ads performance + real website orders for the same days, write a report the AI can read.
//
//   npm run ads:tiktok                        → last 30 days (Bangkok time, today included)
//   npm run ads:tiktok -- --days 7
//   npm run ads:tiktok -- --from 2026-11-01 --to 2026-11-20
//   npm run ads:tiktok -- --no-orders         → skip the DB (TikTok numbers only)
//
// Output (gitignored — ad spend is business data and this repo is public):
//   reports/tiktok-ads/SUMMARY.md       ← read this one to analyse
//   reports/tiktok-ads/<from>_<to>.json ← every raw row (campaign / ad group / ad × day)
//
// ROAS here is "blended": all website orders ÷ TikTok spend. Orders carry no ad attribution
// (no ttclid/utm stored), so it shows the ceiling, not what TikTok alone brought in.
const fs = require('fs');
const path = require('path');
const { loadEnv, requireEnv, call } = require('./lib/tiktok-ads');

const OUT_DIR = path.join(__dirname, '..', 'reports', 'tiktok-ads');
const TZ = 'Asia/Bangkok';
const SOLD = ['PROCESSING', 'PAID', 'SHIPPED', 'DELIVERED'];

const CORE_METRICS = ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'reach', 'conversion', 'cost_per_conversion'];
const EXTRA_METRICS = ['video_play_actions', 'video_watched_2s', 'video_watched_6s', 'average_video_play', 'likes', 'comments', 'shares', 'follows', 'profile_visits'];
const LEVELS = [
  { key: 'campaign', dataLevel: 'AUCTION_CAMPAIGN', id: 'campaign_id', names: ['campaign_name'] },
  { key: 'adgroup', dataLevel: 'AUCTION_ADGROUP', id: 'adgroup_id', names: ['campaign_name', 'adgroup_name'] },
  { key: 'ad', dataLevel: 'AUCTION_AD', id: 'ad_id', names: ['campaign_name', 'adgroup_name', 'ad_name'] },
];
const ADDITIVE = ['spend', 'impressions', 'clicks', 'conversion', ...EXTRA_METRICS.filter((m) => m !== 'average_video_play')];

// ---------- dates ----------
const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function parseArgs(argv) {
  const a = { days: 30, orders: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--days') a.days = Number(argv[++i]);
    else if (argv[i] === '--from') a.from = argv[++i];
    else if (argv[i] === '--to') a.to = argv[++i];
    else if (argv[i] === '--no-orders') a.orders = false;
  }
  a.to = a.to || ymd(new Date());
  a.from = a.from || addDays(a.to, -(a.days - 1));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.from) || !/^\d{4}-\d{2}-\d{2}$/.test(a.to) || a.from > a.to) {
    throw new Error('ช่วงวันที่ไม่ถูกต้อง (ใช้ YYYY-MM-DD และ from ≤ to)');
  }
  return a;
}

// daily reports are queried in ≤30-day windows
function windows(from, to) {
  const out = [];
  for (let s = from; s <= to; s = addDays(s, 30)) {
    const e = addDays(s, 29);
    out.push([s, e < to ? e : to]);
  }
  return out;
}

// ---------- TikTok ----------
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

async function fetchLevel(token, advertiserId, level, from, to, metrics) {
  const rows = [];
  for (const [s, e] of windows(from, to)) {
    for (let page = 1; ; page++) {
      const data = await call('GET', '/report/integrated/get/', {
        token,
        query: {
          advertiser_id: advertiserId,
          report_type: 'BASIC',
          data_level: level.dataLevel,
          dimensions: [level.id, 'stat_time_day'],
          metrics: [...level.names, ...metrics],
          start_date: s,
          end_date: e,
          page: String(page),
          page_size: '1000',
        },
      });
      for (const r of data.list || []) {
        const row = { level: level.key, id: r.dimensions[level.id], date: String(r.dimensions.stat_time_day).slice(0, 10) };
        for (const n of level.names) row[n] = r.metrics[n];
        for (const m of metrics) row[m] = num(r.metrics[m]);
        rows.push(row);
      }
      if (page >= ((data.page_info && data.page_info.total_page) || 1)) break;
    }
  }
  return rows;
}

let metricsInUse = [...CORE_METRICS, ...EXTRA_METRICS];
async function fetchLevelSafe(token, advertiserId, level, from, to) {
  try {
    return await fetchLevel(token, advertiserId, level, from, to, metricsInUse);
  } catch (e) {
    if (metricsInUse.length === CORE_METRICS.length) throw e;
    console.warn(`  ! metrics เสริมใช้ไม่ได้ (${e.message}) — ใช้แค่ชุดหลัก`);
    metricsInUse = [...CORE_METRICS];
    return fetchLevel(token, advertiserId, level, from, to, metricsInUse);
  }
}

// ---------- orders (real sales from the DB) ----------
async function fetchOrders(from, to) {
  const { PrismaClient } = require(path.join(__dirname, '..', 'server', 'node_modules', '@prisma', 'client'));
  const prisma = new PrismaClient();
  try {
    const orders = await prisma.order.findMany({
      where: {
        status: { in: SOLD },
        createdAt: { gte: new Date(from + 'T00:00:00+07:00'), lte: new Date(to + 'T23:59:59.999+07:00') },
      },
      select: {
        createdAt: true, totalAmount: true, status: true, promoCode: true,
        items: { select: { quantity: true, priceAtTime: true, product: { select: { name: true, sku: true } } } },
      },
    });
    return orders.map((o) => ({
      date: ymd(o.createdAt),
      total: o.totalAmount,
      status: o.status,
      promoCode: o.promoCode,
      items: o.items.map((i) => ({ sku: i.product && i.product.sku, name: i.product && i.product.name, qty: i.quantity, price: i.priceAtTime })),
    }));
  } finally {
    await prisma.$disconnect();
  }
}

// ---------- aggregation ----------
function rollup(rows, keyOf) {
  const map = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    if (!map.has(k)) map.set(k, { ...r, days: 0, ...Object.fromEntries(ADDITIVE.map((m) => [m, 0])) });
    const t = map.get(k);
    t.days += 1;
    for (const m of ADDITIVE) t[m] += r[m] || 0;
  }
  for (const t of map.values()) {
    t.ctr = t.impressions ? (t.clicks / t.impressions) * 100 : 0;
    t.cpc = t.clicks ? t.spend / t.clicks : 0;
    t.cpm = t.impressions ? (t.spend / t.impressions) * 1000 : 0;
    t.cost_per_conversion = t.conversion ? t.spend / t.conversion : 0;
    t.hook_rate = t.impressions && t.video_watched_2s ? (t.video_watched_2s / t.impressions) * 100 : null;
    delete t.date; delete t.reach; delete t.average_video_play;
  }
  return [...map.values()].sort((a, b) => b.spend - a.spend);
}

// ---------- markdown ----------
const f0 = (n) => Math.round(n).toLocaleString('en-US');
const f2 = (n) => (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n) => (n == null ? '–' : f2(n) + '%');
const cell = (s) => String(s == null ? '' : s).replace(/\|/g, '/').slice(0, 60);

function table(head, rows) {
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

function flags(ads, totalSpend) {
  const out = [];
  for (const a of ads) {
    const share = totalSpend ? a.spend / totalSpend : 0;
    if (share >= 0.1 && a.conversion === 0) out.push(`- 🔴 **${cell(a.ad_name)}** ใช้เงิน ${f0(a.spend)} (${pct(share * 100)} ของงบ) แต่ conversion = 0`);
    if (a.impressions >= 1000 && a.ctr < 0.5) out.push(`- 🟠 **${cell(a.ad_name)}** CTR ${pct(a.ctr)} ต่ำ (คนเห็น ${f0(a.impressions)} แต่ไม่ค่อยกด) — hook/ปกอาจไม่ดึง`);
    if (a.hook_rate != null && a.impressions >= 1000 && a.hook_rate < 20) out.push(`- 🟠 **${cell(a.ad_name)}** ดูเกิน 2 วิแค่ ${pct(a.hook_rate)} — 2 วิแรกไม่หยุดนิ้ว`);
  }
  const withConv = ads.filter((a) => a.conversion > 0).sort((a, b) => a.cost_per_conversion - b.cost_per_conversion);
  if (withConv[0]) out.push(`- 🟢 ต้นทุนต่อ conversion ถูกสุด: **${cell(withConv[0].ad_name)}** ${f2(withConv[0].cost_per_conversion)} (${f0(withConv[0].conversion)} conversion)`);
  return out.length ? out : ['- (ยังไม่มีอะไรผิดปกติตามเกณฑ์อัตโนมัติ)'];
}

function buildMarkdown({ args, accounts, campaigns, adgroups, ads, daily, orders, ordersError }) {
  const spend = campaigns.reduce((s, c) => s + c.spend, 0);
  const impressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const clicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const conv = campaigns.reduce((s, c) => s + c.conversion, 0);
  const currency = [...new Set(accounts.map((a) => a.currency).filter(Boolean))].join('/') || '?';
  const revenue = orders ? orders.reduce((s, o) => s + o.total, 0) : null;

  const L = [];
  L.push(`# TikTok Ads — ${args.from} ถึง ${args.to}`, '');
  L.push(`> สร้างเมื่อ ${new Date().toLocaleString('th-TH', { timeZone: TZ })} · บัญชี: ${accounts.map((a) => `${a.name || a.advertiser_id} (${a.currency || '?'})`).join(', ')}`);
  L.push('> ROAS = ยอดขายเว็บทั้งหมด ÷ ค่าโฆษณา TikTok (blended — ออเดอร์ไม่ได้เก็บว่ามาจากโฆษณาไหน)', '');

  L.push('## ภาพรวม', '');
  const overview = [
    ['ค่าโฆษณา', `${f2(spend)} ${currency}`],
    ['แสดงผล / คลิก', `${f0(impressions)} / ${f0(clicks)}`],
    ['CTR / CPC / CPM', `${pct(impressions ? (clicks / impressions) * 100 : 0)} / ${f2(clicks ? spend / clicks : 0)} / ${f2(impressions ? (spend / impressions) * 1000 : 0)}`],
    ['Conversion (ตาม TikTok)', `${f0(conv)}${conv ? ` · ${f2(spend / conv)} ต่อครั้ง` : ''}`],
  ];
  if (orders) {
    overview.push(['ออเดอร์จริงบนเว็บ', `${orders.length} ออเดอร์ · ${f2(revenue)} บาท`]);
    overview.push(['Blended ROAS', spend ? f2(revenue / spend) + 'x' : '–']);
    overview.push(['ค่าโฆษณาต่อออเดอร์จริง', orders.length ? f2(spend / orders.length) : '–']);
  } else {
    overview.push(['ออเดอร์จริงบนเว็บ', ordersError ? `ดึงไม่ได้: ${ordersError}` : 'ข้าม (--no-orders)']);
  }
  L.push(table(['ตัวชี้วัด', 'ค่า'], overview), '');

  L.push('## จุดที่ควรดู', '', ...flags(ads, spend), '');

  L.push('## รายวัน', '');
  L.push(table(['วันที่', 'ค่าโฆษณา', 'คลิก', 'CTR', 'Conv.', 'ออเดอร์', 'ยอดขาย', 'ROAS'],
    daily.map((d) => [d.date, f2(d.spend), f0(d.clicks), pct(d.ctr), f0(d.conversion),
      d.orders == null ? '–' : d.orders, d.revenue == null ? '–' : f2(d.revenue),
      d.spend && d.revenue != null ? f2(d.revenue / d.spend) + 'x' : '–'])), '');

  L.push('## แคมเปญ', '');
  L.push(table(['แคมเปญ', 'ค่าโฆษณา', 'แสดงผล', 'CTR', 'CPC', 'Conv.', 'ต่อ Conv.'],
    campaigns.map((c) => [cell(c.campaign_name), f2(c.spend), f0(c.impressions), pct(c.ctr), f2(c.cpc), f0(c.conversion), c.conversion ? f2(c.cost_per_conversion) : '–'])), '');

  L.push('## ชุดโฆษณา', '');
  L.push(table(['ชุดโฆษณา', 'แคมเปญ', 'ค่าโฆษณา', 'CTR', 'CPM', 'Conv.', 'ต่อ Conv.'],
    adgroups.map((g) => [cell(g.adgroup_name), cell(g.campaign_name), f2(g.spend), pct(g.ctr), f2(g.cpm), f0(g.conversion), g.conversion ? f2(g.cost_per_conversion) : '–'])), '');

  L.push('## โฆษณา (ครีเอทีฟ)', '');
  L.push(table(['โฆษณา', 'ชุดโฆษณา', 'ค่าโฆษณา', 'แสดงผล', 'CTR', 'ดู ≥2 วิ', 'ดู ≥6 วิ', 'Conv.', 'ต่อ Conv.'],
    ads.map((a) => [cell(a.ad_name), cell(a.adgroup_name), f2(a.spend), f0(a.impressions), pct(a.ctr), pct(a.hook_rate),
      a.impressions && a.video_watched_6s ? pct((a.video_watched_6s / a.impressions) * 100) : '–', f0(a.conversion), a.conversion ? f2(a.cost_per_conversion) : '–'])), '');

  if (orders && orders.length) {
    const bySku = new Map();
    for (const o of orders) for (const i of o.items) {
      const k = i.sku || i.name;
      const t = bySku.get(k) || { sku: i.sku, name: i.name, qty: 0, revenue: 0 };
      t.qty += i.qty; t.revenue += i.qty * i.price;
      bySku.set(k, t);
    }
    L.push('## สินค้าที่ขายได้ช่วงนี้', '');
    L.push(table(['SKU', 'สินค้า', 'ชิ้น', 'ยอดขาย'],
      [...bySku.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 20).map((s) => [s.sku || '–', cell(s.name), s.qty, f2(s.revenue)])), '');
  }

  L.push('---', `ข้อมูลดิบ: \`reports/tiktok-ads/${args.from}_${args.to}.json\``);
  return L.join('\n') + '\n';
}

// ---------- main ----------
(async () => {
  loadEnv();
  requireEnv('TIKTOK_ADS_ACCESS_TOKEN', 'TIKTOK_ADVERTISER_IDS');
  const args = parseArgs(process.argv.slice(2));
  const token = process.env.TIKTOK_ADS_ACCESS_TOKEN;
  const ids = process.env.TIKTOK_ADVERTISER_IDS.split(',').map((s) => s.trim()).filter(Boolean);
  console.log(`TikTok Ads ${args.from} → ${args.to} · ${ids.length} บัญชี`);

  let accounts = ids.map((id) => ({ advertiser_id: id }));
  try {
    const info = await call('GET', '/advertiser/info/', { token, query: { advertiser_ids: ids, fields: ['advertiser_id', 'name', 'currency', 'timezone'] } });
    accounts = (info.list || []).map((a) => ({ advertiser_id: String(a.advertiser_id), name: a.name, currency: a.currency, timezone: a.timezone }));
  } catch (e) {
    console.warn('  ! อ่านข้อมูลบัญชีไม่ได้: ' + e.message);
  }

  const rows = [];
  for (const id of ids) {
    for (const level of LEVELS) {
      const r = await fetchLevelSafe(token, id, level, args.from, args.to);
      r.forEach((x) => { x.advertiser_id = id; });
      rows.push(...r);
      console.log(`  ${id} ${level.key}: ${r.length} แถว`);
    }
  }

  let orders = null;
  let ordersError = null;
  if (args.orders) {
    try {
      orders = await fetchOrders(args.from, args.to);
      console.log(`  ออเดอร์จริง: ${orders.length}`);
    } catch (e) {
      ordersError = e.message.split('\n')[0];
      console.warn('  ! ดึงออเดอร์ไม่ได้: ' + ordersError);
    }
  }

  const byLevel = (k) => rows.filter((r) => r.level === k);
  const campaigns = rollup(byLevel('campaign'), (r) => r.id);
  const adgroups = rollup(byLevel('adgroup'), (r) => r.id);
  const ads = rollup(byLevel('ad'), (r) => r.id);

  const daily = [];
  for (let d = args.from; d <= args.to; d = addDays(d, 1)) {
    const day = byLevel('campaign').filter((r) => r.date === d);
    const t = { date: d, spend: 0, clicks: 0, impressions: 0, conversion: 0 };
    for (const r of day) { t.spend += r.spend; t.clicks += r.clicks; t.impressions += r.impressions; t.conversion += r.conversion; }
    t.ctr = t.impressions ? (t.clicks / t.impressions) * 100 : 0;
    if (orders) {
      const od = orders.filter((o) => o.date === d);
      t.orders = od.length;
      t.revenue = od.reduce((s, o) => s + o.total, 0);
    }
    daily.push(t);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const base = `${args.from}_${args.to}`;
  fs.writeFileSync(path.join(OUT_DIR, base + '.json'), JSON.stringify({
    generatedAt: new Date().toISOString(), range: { from: args.from, to: args.to }, accounts,
    metrics: metricsInUse, totals: { campaigns, adgroups, ads }, daily, rows, orders, ordersError,
  }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'SUMMARY.md'), buildMarkdown({ args, accounts, campaigns, adgroups, ads, daily, orders, ordersError }));
  console.log(`\n✓ reports/tiktok-ads/SUMMARY.md + ${base}.json`);
})().catch((e) => {
  console.error('✗ ' + e.message);
  process.exit(1);
});
