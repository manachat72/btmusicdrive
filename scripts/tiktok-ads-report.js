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
// Two kinds of revenue: TikTok Shop GMV (attributed by TikTok to each ad) and website orders from
// the DB. Website ROAS is "blended": all website orders ÷ TikTok spend. Orders carry no ad attribution
// (no ttclid/utm stored), so it shows the ceiling, not what TikTok alone brought in.
const fs = require('fs');
const path = require('path');
const { loadEnv, requireEnv, call } = require('./lib/tiktok-ads');

const OUT_DIR = path.join(__dirname, '..', 'reports', 'tiktok-ads');
const TZ = 'Asia/Bangkok';
const SOLD = ['PROCESSING', 'PAID', 'SHIPPED', 'DELIVERED'];

const CORE_METRICS = ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'reach', 'conversion', 'cost_per_conversion'];
// TikTok Shop (Product Sales / GMV) — orders and sales value that happened inside TikTok Shop
const SHOP_METRICS = ['onsite_shopping', 'total_onsite_shopping_value', 'onsite_initiate_checkout_count', 'onsite_on_web_detail'];
const EXTRA_METRICS = ['video_play_actions', 'video_watched_2s', 'video_watched_6s', 'average_video_play', 'likes', 'comments', 'shares', 'follows', 'profile_visits'];
// tried in order — an account that rejects a metric group falls back to the next set
const METRIC_SETS = [
  [...CORE_METRICS, ...SHOP_METRICS, ...EXTRA_METRICS],
  [...CORE_METRICS, ...SHOP_METRICS],
  [...CORE_METRICS],
];
const LEVELS = [
  { key: 'campaign', dataLevel: 'AUCTION_CAMPAIGN', id: 'campaign_id', names: ['campaign_name'] },
  { key: 'adgroup', dataLevel: 'AUCTION_ADGROUP', id: 'adgroup_id', names: ['campaign_name', 'adgroup_name'] },
  { key: 'ad', dataLevel: 'AUCTION_AD', id: 'ad_id', names: ['campaign_name', 'adgroup_name', 'ad_name'] },
];
const ADDITIVE = ['spend', 'impressions', 'clicks', 'conversion', ...SHOP_METRICS, ...EXTRA_METRICS.filter((m) => m !== 'average_video_play')];

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

let metricSet = 0;
let metricsInUse = METRIC_SETS[0];
async function fetchLevelSafe(token, advertiserId, level, from, to) {
  for (;;) {
    try {
      return await fetchLevel(token, advertiserId, level, from, to, metricsInUse);
    } catch (e) {
      if (e.code !== 40002 || metricSet === METRIC_SETS.length - 1) throw e;
      metricsInUse = METRIC_SETS[++metricSet];
      console.warn(`  ! metrics บางตัวใช้ไม่ได้ (${e.message}) — ลดเหลือ ${metricsInUse.length} ตัว`);
    }
  }
}

// creative details: which creator's post, which TikTok video, which Shop product (item_group_id)
async function fetchAdDetails(token, advertiserId) {
  const out = {};
  for (let page = 1; ; page++) {
    const data = await call('GET', '/ad/get/', { token, query: { advertiser_id: advertiserId, page: String(page), page_size: '1000' } });
    for (const a of data.list || []) {
      out[a.ad_id] = {
        creator: a.display_name || a.identity_id || null,
        videoId: a.tiktok_item_id || null,
        videoUrl: a.tiktok_item_id ? `https://www.tiktok.com/player/v1/${a.tiktok_item_id}` : null,
        productIds: a.item_group_ids || [],
        format: a.ad_format || null,
        creativeType: a.creative_type || null,
        adText: a.ad_text || null,
        status: a.operation_status || null,
        createdAt: a.create_time || null,
      };
    }
    if (page >= ((data.page_info && data.page_info.total_page) || 1)) break;
  }
  return out;
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
    t.shop_roas = t.spend && t.total_onsite_shopping_value ? t.total_onsite_shopping_value / t.spend : 0;
    t.cost_per_shop_order = t.onsite_shopping ? t.spend / t.onsite_shopping : 0;
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

const isVideo = (a) => a.info && /VIDEO/.test(a.info.format || '') && a.info.creativeType !== 'SHOPPING_SHOP_PAGE_CARD';
const adLabel = (a) => {
  const i = a.info || {};
  return `${cell(i.creator || a.ad_name)}${i.videoId ? ` · …${String(i.videoId).slice(-6)}` : ''}`;
};

function flags(ads, totalSpend, hasShop) {
  const out = [];
  for (const a of ads) {
    const share = totalSpend ? a.spend / totalSpend : 0;
    const name = adLabel(a);
    if (hasShop) {
      if (share >= 0.1 && a.shop_roas < 2) out.push(`- 🔴 **${name}** ใช้เงิน ${f0(a.spend)} (${pct(share * 100)} ของงบ) แต่ ROAS ร้านค้าแค่ ${f2(a.shop_roas)}x`);
    } else if (share >= 0.1 && a.conversion === 0) {
      out.push(`- 🔴 **${name}** ใช้เงิน ${f0(a.spend)} (${pct(share * 100)} ของงบ) แต่ conversion = 0`);
    }
    if (a.impressions >= 1000 && a.ctr < 0.5) out.push(`- 🟠 **${name}** CTR ${pct(a.ctr)} ต่ำ (คนเห็น ${f0(a.impressions)} แต่ไม่ค่อยกด) — hook/ปกอาจไม่ดึง`);
    if (isVideo(a) && a.hook_rate != null && a.impressions >= 1000 && a.hook_rate < 10 && a.shop_roas < 5) {
      out.push(`- 🟠 **${name}** ดูเกิน 2 วิแค่ ${pct(a.hook_rate)} — 2 วิแรกไม่หยุดนิ้ว`);
    }
    if (a.hook_rate != null && a.hook_rate >= 30 && a.impressions >= 1000 && a.ctr < 2) {
      out.push(`- 🟠 **${name}** คนดูต่อ ${pct(a.hook_rate)} แต่ CTR ${pct(a.ctr)} — คลิปดูสนุกแต่ไม่ชวนซื้อ (ใส่ราคา/ข้อเสนอให้ชัดขึ้น)`);
    }
  }
  const key = hasShop ? 'shop_roas' : null;
  const ranked = hasShop
    ? ads.filter((a) => a.spend >= 50 && a.onsite_shopping > 0).sort((a, b) => b[key] - a[key])
    : ads.filter((a) => a.conversion > 0).sort((a, b) => a.cost_per_conversion - b.cost_per_conversion);
  if (ranked[0]) {
    const b = ranked[0];
    out.push(hasShop
      ? `- 🟢 ROAS สูงสุด (ใช้เงิน ≥50): **${adLabel(b)}** ${f2(b.shop_roas)}x · ${f0(b.onsite_shopping)} ออเดอร์ · ยอดขาย ${f0(b.total_onsite_shopping_value)}`
      : `- 🟢 ต้นทุนต่อ conversion ถูกสุด: **${adLabel(b)}** ${f2(b.cost_per_conversion)} (${f0(b.conversion)} conversion)`);
  }
  return out.length ? out : ['- (ยังไม่มีอะไรผิดปกติตามเกณฑ์อัตโนมัติ)'];
}

function groupBy(ads, keyOf) {
  const m = new Map();
  for (const a of ads) for (const k of keyOf(a)) {
    const t = m.get(k) || { key: k, ads: 0, spend: 0, impressions: 0, clicks: 0, orders: 0, gmv: 0 };
    t.ads += 1; t.spend += a.spend; t.impressions += a.impressions; t.clicks += a.clicks;
    t.orders += a.onsite_shopping || 0; t.gmv += a.total_onsite_shopping_value || 0;
    m.set(k, t);
  }
  return [...m.values()].sort((a, b) => b.gmv - a.gmv || b.spend - a.spend);
}

function buildMarkdown({ args, accounts, campaigns, adgroups, ads, daily, orders, ordersError }) {
  const sum = (k) => campaigns.reduce((s, c) => s + (c[k] || 0), 0);
  const spend = sum('spend');
  const impressions = sum('impressions');
  const clicks = sum('clicks');
  const conv = sum('conversion');
  const shopOrders = sum('onsite_shopping');
  const gmv = sum('total_onsite_shopping_value');
  const hasShop = metricsInUse.includes('total_onsite_shopping_value') && (shopOrders > 0 || gmv > 0);
  const currency = [...new Set(accounts.map((a) => a.currency).filter(Boolean))].join('/') || '?';
  const revenue = orders ? orders.reduce((s, o) => s + o.total, 0) : null;

  const L = [];
  L.push(`# TikTok Ads — ${args.from} ถึง ${args.to}`, '');
  L.push(`> สร้างเมื่อ ${new Date().toLocaleString('th-TH', { timeZone: TZ })} · บัญชี: ${accounts.map((a) => `${a.name || a.advertiser_id} (${a.currency || '?'})`).join(', ')}`);
  L.push('> **ยอดขาย TikTok Shop** = ออเดอร์/มูลค่าที่ TikTok นับว่าเกิดจากโฆษณา (Product Sales/GMV) · **ยอดขายเว็บ** = ออเดอร์จริงใน DB ของ btmusicdrive.com หารด้วยค่าโฆษณาทั้งหมด (blended — ออเดอร์เว็บไม่ได้เก็บว่ามาจากโฆษณาไหน)', '');

  L.push('## ภาพรวม', '');
  const overview = [
    ['ค่าโฆษณา', `${f2(spend)} ${currency}`],
    ['แสดงผล / คลิก', `${f0(impressions)} / ${f0(clicks)}`],
    ['CTR / CPC / CPM', `${pct(impressions ? (clicks / impressions) * 100 : 0)} / ${f2(clicks ? spend / clicks : 0)} / ${f2(impressions ? (spend / impressions) * 1000 : 0)}`],
    ['Conversion (ตาม TikTok)', `${f0(conv)}${conv ? ` · ${f2(spend / conv)} ต่อครั้ง` : ''}`],
  ];
  if (hasShop) {
    overview.push(['ออเดอร์ TikTok Shop', `${f0(shopOrders)} · ${f2(shopOrders ? spend / shopOrders : 0)} ต่อออเดอร์`]);
    overview.push(['ยอดขาย TikTok Shop (GMV)', `${f2(gmv)} ${currency} · เฉลี่ย ${f2(shopOrders ? gmv / shopOrders : 0)} ต่อออเดอร์`]);
    overview.push(['ROAS ร้านค้า', spend ? f2(gmv / spend) + 'x' : '–']);
    overview.push(['ดูหน้าสินค้า → เริ่มชำระ → ซื้อ', `${f0(sum('onsite_on_web_detail'))} → ${f0(sum('onsite_initiate_checkout_count'))} → ${f0(shopOrders)}`]);
  }
  if (orders) {
    overview.push(['ออเดอร์จริงบนเว็บ', `${orders.length} ออเดอร์ · ${f2(revenue)} บาท`]);
    overview.push(['Blended ROAS (เว็บ)', spend ? f2(revenue / spend) + 'x' : '–']);
  } else {
    overview.push(['ออเดอร์จริงบนเว็บ', ordersError ? `ดึงไม่ได้: ${ordersError}` : 'ข้าม (--no-orders)']);
  }
  L.push(table(['ตัวชี้วัด', 'ค่า'], overview), '');

  L.push('## จุดที่ควรดู', '', ...flags(ads, spend, hasShop), '');

  const active = daily.filter((d) => d.spend > 0 || d.orders || d.shopOrders);
  L.push('## รายวัน', '', `(แสดงเฉพาะวันที่มีค่าโฆษณาหรือมีออเดอร์ — ${active.length} จาก ${daily.length} วัน)`, '');
  L.push(table(['วันที่', 'ค่าโฆษณา', 'คลิก', 'CTR', ...(hasShop ? ['ออเดอร์ Shop', 'GMV', 'ROAS Shop'] : ['Conv.']), 'ออเดอร์เว็บ', 'ยอดเว็บ'],
    active.map((d) => [d.date, f2(d.spend), f0(d.clicks), pct(d.ctr),
      ...(hasShop ? [f0(d.shopOrders), f0(d.gmv), d.spend ? f2(d.gmv / d.spend) + 'x' : '–'] : [f0(d.conversion)]),
      d.orders == null ? '–' : d.orders, d.revenue == null ? '–' : f2(d.revenue)])), '');

  const shopCols = (x) => (hasShop ? [f0(x.onsite_shopping), f0(x.total_onsite_shopping_value), f2(x.shop_roas) + 'x'] : [f0(x.conversion), x.conversion ? f2(x.cost_per_conversion) : '–']);
  const shopHead = hasShop ? ['ออเดอร์ Shop', 'GMV', 'ROAS'] : ['Conv.', 'ต่อ Conv.'];

  L.push('## แคมเปญ', '');
  L.push(table(['แคมเปญ', 'ค่าโฆษณา', 'แสดงผล', 'CTR', 'CPC', ...shopHead],
    campaigns.filter((c) => c.spend > 0).map((c) => [cell(c.campaign_name), f2(c.spend), f0(c.impressions), pct(c.ctr), f2(c.cpc), ...shopCols(c)])), '');

  L.push('## ชุดโฆษณา', '');
  L.push(table(['ชุดโฆษณา', 'แคมเปญ', 'ค่าโฆษณา', 'CTR', 'CPM', ...shopHead],
    adgroups.filter((g) => g.spend > 0).map((g) => [cell(g.adgroup_name), cell(g.campaign_name), f2(g.spend), pct(g.ctr), f2(g.cpm), ...shopCols(g)])), '');

  L.push('## โฆษณา (ครีเอทีฟ)', '');
  L.push(table(['ครีเอเตอร์ · คลิป', 'แคมเปญ', 'รูปแบบ', 'ค่าโฆษณา', 'แสดงผล', 'CTR', 'ดู ≥2 วิ', 'ดู ≥6 วิ', ...shopHead, 'สินค้า (item_group_id)'],
    ads.filter((a) => a.spend > 0).map((a) => {
      const i = a.info || {};
      return [
        i.videoUrl ? `[${adLabel(a)}](${i.videoUrl})` : adLabel(a), cell(a.campaign_name), cell(i.creativeType || i.format || '–'),
        f2(a.spend), f0(a.impressions), pct(a.ctr), pct(a.hook_rate),
        a.impressions && a.video_watched_6s ? pct((a.video_watched_6s / a.impressions) * 100) : '–',
        ...shopCols(a), (i.productIds || []).join(', ') || '–',
      ];
    })), '');

  if (hasShop) {
    L.push('## แยกตามครีเอเตอร์', '');
    L.push(table(['ครีเอเตอร์', 'โฆษณา', 'ค่าโฆษณา', 'CTR', 'ออเดอร์ Shop', 'GMV', 'ROAS'],
      groupBy(ads, (a) => [(a.info && a.info.creator) || '(ไม่ทราบ)']).map((g) => [cell(g.key), g.ads, f2(g.spend), pct(g.impressions ? (g.clicks / g.impressions) * 100 : 0), f0(g.orders), f0(g.gmv), g.spend ? f2(g.gmv / g.spend) + 'x' : '–'])), '');
    L.push('## แยกตามสินค้า TikTok Shop', '', '(ชื่อสินค้าต้องเปิดสิทธิ์ Store/Catalog ในแอป TikTok ก่อน — ตอนนี้แสดงเป็น item_group_id · โฆษณาที่ผูกหลายสินค้าจะนับซ้ำในทุกสินค้านั้น)', '');
    L.push(table(['item_group_id', 'โฆษณา', 'ค่าโฆษณา', 'ออเดอร์ Shop', 'GMV', 'ROAS'],
      groupBy(ads, (a) => ((a.info && a.info.productIds.length) ? a.info.productIds : ['(ไม่ระบุ)'])).map((g) => [g.key, g.ads, f2(g.spend), f0(g.orders), f0(g.gmv), g.spend ? f2(g.gmv / g.spend) + 'x' : '–'])), '');
  }

  if (orders && orders.length) {
    const bySku = new Map();
    for (const o of orders) for (const i of o.items) {
      const k = i.sku || i.name;
      const t = bySku.get(k) || { sku: i.sku, name: i.name, qty: 0, revenue: 0 };
      t.qty += i.qty; t.revenue += i.qty * i.price;
      bySku.set(k, t);
    }
    L.push('## สินค้าที่ขายได้บนเว็บช่วงนี้', '');
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
  const adInfo = {};
  for (const id of ids) {
    try {
      Object.assign(adInfo, await fetchAdDetails(token, id));
    } catch (e) {
      console.warn(`  ! ${id} อ่านรายละเอียดโฆษณาไม่ได้: ${e.message}`);
    }
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
  for (const a of ads) a.info = adInfo[a.id] || null;

  const daily = [];
  for (let d = args.from; d <= args.to; d = addDays(d, 1)) {
    const day = byLevel('campaign').filter((r) => r.date === d);
    const t = { date: d, spend: 0, clicks: 0, impressions: 0, conversion: 0, shopOrders: 0, gmv: 0 };
    for (const r of day) {
      t.spend += r.spend; t.clicks += r.clicks; t.impressions += r.impressions; t.conversion += r.conversion;
      t.shopOrders += r.onsite_shopping || 0; t.gmv += r.total_onsite_shopping_value || 0;
    }
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
