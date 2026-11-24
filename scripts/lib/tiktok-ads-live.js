/**
 * TikTok Ads (live) - คุมแคมเปญ: เปิด/ปิด ปรับงบ — เป็นแท็บในหน้า Product Studio (พอร์ตเดียวกัน 4777)
 *
 * ความปลอดภัย (ดู AGENTS.md ข้อ 0): หน้านี้ "เขียน" ลง TikTok จริงได้
 *  - รับเฉพาะ Host = 127.0.0.1 / localhost (ห้ามเปิดผ่าน Cloudflare Tunnel แบบโล่ง — ต้องครอบ Cloudflare Access)
 *  - token อ่านจาก server/.env.local ฝั่งเซิร์ฟเวอร์เท่านั้น ไม่ส่งไปที่เบราว์เซอร์
 *  - ทุกคำสั่งเขียนต้องมี header X-Dashboard: 1 (กัน CSRF) และถูกบันทึก audit log
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ENV_FILE = path.resolve(__dirname, '..', '..', 'server', '.env.local');
const AUDIT = process.env.TIKTOK_AUDIT_LOG || path.resolve(__dirname, '..', '..', '..', 'tiktok-ads-analysis', 'data', 'dashboard-audit.jsonl');
const PREFIX = '/ads-live';
const API = 'https://business-api.tiktok.com/open_api/v1.3';

function loadEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m) env[m[1]] = m[2];
    }
  } catch { /* ignore */ }
  return { ...env, ...process.env };
}
const ENV = loadEnv();
const TOKEN = ENV.TIKTOK_ADS_ACCESS_TOKEN || ENV.TIKTOK_ACCESS_TOKEN;
const ADV_IDS = (ENV.TIKTOK_ADVERTISER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
const ADV_NAMES = { '7442465076160282640': 'buythrrmshop' };

async function tt(method, endpoint, params) {
  const url = new URL(API + endpoint);
  const opt = { method, headers: { 'Access-Token': TOKEN } };
  if (method === 'GET') {
    for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  } else {
    opt.headers['Content-Type'] = 'application/json';
    opt.body = JSON.stringify(params || {});
  }
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { ...opt, signal: AbortSignal.timeout(30000) });
    const d = await r.json();
    if (d.code === 40100 && attempt < 5) { await new Promise((ok) => setTimeout(ok, 500 * (attempt + 1))); continue; } // QPS limit → รอแล้วลองใหม่
    if (d.code !== 0) throw new Error(`TikTok ${d.code}: ${d.message}`);
    return d.data || {};
  }
}

async function listAll(endpoint, params) {
  let page = 1; const out = [];
  for (;;) {
    const d = await tt('GET', endpoint, { ...params, page, page_size: 100 });
    out.push(...(d.list || []));
    if (page >= ((d.page_info || {}).total_page || 1)) break;
    page++;
  }
  return out;
}

const METRICS = ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'conversion', 'cost_per_conversion', 'total_onsite_shopping_value', 'onsite_shopping'];
const num = (v) => Number(v) || 0;
const iso = (d) => d.toISOString().slice(0, 10);

function row(m) {
  const spend = num(m.spend), rev = num(m.total_onsite_shopping_value), orders = num(m.onsite_shopping || m.conversion);
  return { spend, impressions: num(m.impressions), clicks: num(m.clicks), orders, revenue: rev };
}
function finish(r) {
  r.ctr = r.impressions ? +(r.clicks / r.impressions * 100).toFixed(2) : 0;
  r.cpc = r.clicks ? +(r.spend / r.clicks).toFixed(2) : 0;
  r.roas = r.spend ? +(r.revenue / r.spend).toFixed(2) : 0;
  r.cpa = r.orders ? +(r.spend / r.orders).toFixed(2) : 0;
  return r;
}
const add = (a, b) => { for (const k of ['spend', 'impressions', 'clicks', 'orders', 'revenue']) a[k] = (a[k] || 0) + b[k]; return a; };

// TikTok จำกัดช่วงรายงาน < 365 วันต่อครั้ง → แบ่งเป็นช่วงละ 360 วัน
function chunks(start, end, span = 360) {
  const out = []; let s = new Date(start + 'T00:00:00Z'); const e = new Date(end + 'T00:00:00Z');
  while (s <= e) { const t = new Date(Math.min(s.getTime() + (span - 1) * 864e5, e.getTime())); out.push([iso(s), iso(t)]); s = new Date(t.getTime() + 864e5); }
  return out;
}

// GMV Max (แคมเปญ TikTok Shop แบบใหม่) ไม่ออกมาใน /campaign/get/ และรายงานปกติ — ต้องใช้ /gmv_max/* แยก
// ต้องมี store_ids · รายงานรายวันจำกัดครั้งละ 30 วัน · งบอยู่ใน /campaign/gmv_max/info/ (ทีละแคมเปญ)
const GMV_METRICS = ['cost', 'orders', 'gross_revenue'];
const gmvRow = (m) => ({ spend: num(m.cost), impressions: 0, clicks: 0, orders: num(m.orders), revenue: num(m.gross_revenue) });

async function gmvMaxCampaigns(adv) {
  const list = [];
  for (const t of ['PRODUCT_GMV_MAX', 'LIVE_GMV_MAX']) list.push(...await listAll('/gmv_max/campaign/get/', { advertiser_id: adv, filtering: { gmv_max_promotion_types: [t] } }));
  if (!list.length) return { list, storeIds: [] };
  const stores = (await tt('GET', '/gmv_max/store/list/', { advertiser_id: adv })).store_list || [];
  return { list, storeIds: stores.map((s) => s.store_id) };
}

async function gmvMaxReport(adv, storeIds, start, end) {
  const camp = {}, daily = {};
  if (!storeIds.length) return { camp, daily };
  const base = { advertiser_id: adv, store_ids: storeIds, metrics: GMV_METRICS };
  for (const [s, e] of chunks(start, end)) {
    for (const r of await listAll('/gmv_max/report/get/', { ...base, start_date: s, end_date: e, dimensions: ['campaign_id'] })) add(camp[r.dimensions.campaign_id] ||= {}, gmvRow(r.metrics));
  }
  const dc = chunks(start, end, 30);
  for (let i = 0; i < dc.length; i += 3) {
    const parts = await Promise.all(dc.slice(i, i + 3).map(([s, e]) => listAll('/gmv_max/report/get/', { ...base, start_date: s, end_date: e, dimensions: ['advertiser_id', 'stat_time_day'] })));
    for (const day of parts) for (const d of day) add(daily[d.dimensions.stat_time_day.slice(0, 10)] ||= {}, gmvRow(d.metrics));
  }
  return { camp, daily };
}

async function overview(adv, q) {
  const campaigns = await listAll('/campaign/get/', { advertiser_id: adv });
  let gmv = { list: [], storeIds: [] }, gmvError = null;
  try { gmv = await gmvMaxCampaigns(adv); } catch (e) { gmvError = e.message; }
  const earliest = [...campaigns, ...gmv.list].map((c) => (c.create_time || '').slice(0, 10)).filter(Boolean).sort()[0] || '2024-01-01';
  const days = q.get('days');
  const end = iso(new Date());
  const start = days === 'all' ? earliest : iso(new Date(Date.now() - (Math.min(Math.max(parseInt(days, 10) || 30, 1), 1200) - 1) * 864e5));
  const camp = {}, daily = [];
  for (const [s, e] of chunks(start, end)) {
    const rep = await listAll('/report/integrated/get/', { advertiser_id: adv, report_type: 'BASIC', start_date: s, end_date: e, data_level: 'AUCTION_CAMPAIGN', dimensions: ['campaign_id'], metrics: METRICS });
    for (const r of rep) add(camp[r.dimensions.campaign_id] ||= {}, row(r.metrics));
  }
  // dimension รายวัน TikTok จำกัดครั้งละ 30 วัน → ยิงขนานทีละ 3 ช่วง
  const dc = chunks(start, end, 30);
  for (let i = 0; i < dc.length; i += 3) {
    const parts = await Promise.all(dc.slice(i, i + 3).map(([s, e]) => listAll('/report/integrated/get/', { advertiser_id: adv, report_type: 'BASIC', start_date: s, end_date: e, data_level: 'AUCTION_ADVERTISER', dimensions: ['stat_time_day'], metrics: METRICS })));
    for (const day of parts) for (const d of day) daily.push({ date: d.dimensions.stat_time_day.slice(0, 10), ...row(d.metrics) });
  }
  const zero = { spend: 0, impressions: 0, clicks: 0, orders: 0, revenue: 0 };
  const rows = campaigns.map((c) => ({
    id: c.campaign_id, name: c.campaign_name, status: c.operation_status, secondary: c.secondary_status,
    objective: c.objective_type, budgetMode: c.budget_mode, budget: num(c.budget), type: 'MANUAL',
    ...finish({ ...zero, ...(camp[c.campaign_id] || {}) }),
  }));
  // รวม GMV Max เข้าแถว/ยอดรวม/กราฟรายวัน
  if (gmv.list.length) {
    try {
      const rep = await gmvMaxReport(adv, gmv.storeIds, start, end);
      const budgets = {};
      await Promise.all(gmv.list.filter((c) => c.operation_status === 'ENABLE').map(async (c) => {
        try { budgets[c.campaign_id] = num((await tt('GET', '/campaign/gmv_max/info/', { advertiser_id: adv, campaign_id: c.campaign_id })).budget); } catch { /* งบไม่ขึ้นก็ยังแสดงแถว */ }
      }));
      for (const c of gmv.list) rows.push({ id: c.campaign_id, name: c.campaign_name, status: c.operation_status, secondary: c.secondary_status,
        objective: c.objective_type, budgetMode: c.campaign_id in budgets ? 'BUDGET_MODE_DAY' : 'UNKNOWN', budget: budgets[c.campaign_id] || 0, type: 'GMV_MAX',
        ...finish({ ...zero, ...(rep.camp[c.campaign_id] || {}) }) });
      for (const [date, m] of Object.entries(rep.daily)) daily.push({ date, ...m });
    } catch (e) { gmvError = e.message; }
  }
  rows.sort((a, b) => b.spend - a.spend);
  const byDate = {};
  for (const d of daily) add(byDate[d.date] ||= { date: d.date }, d);
  const totals = finish(rows.reduce((t, r) => add(t, r), {}));
  return { advertiser: adv, name: ADV_NAMES[adv] || adv, range: { start_date: start, end_date: end }, totals, campaigns: rows, gmvError,
    daily: Object.values(byDate).map(finish).sort((a, b) => a.date.localeCompare(b.date)) };
}

async function adgroups(adv, campaignId) {
  const list = await listAll('/adgroup/get/', { advertiser_id: adv, filtering: { campaign_ids: [campaignId] } });
  return list.map((g) => ({ id: g.adgroup_id, name: g.adgroup_name, status: g.operation_status, secondary: g.secondary_status,
    budgetMode: g.budget_mode, budget: num(g.budget), placement: g.placement_type }));
}

function audit(entry) {
  try { fs.mkdirSync(path.dirname(AUDIT), { recursive: true }); fs.appendFileSync(AUDIT, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n'); } catch { /* ignore */ }
}

async function writeOp(body) {
  const { advertiser, level, id, action, value } = body;
  if (!ADV_IDS.includes(advertiser)) throw new Error('advertiser ไม่อยู่ในรายการ');
  if (!/^\d+$/.test(String(id))) throw new Error('id ไม่ถูกต้อง');
  let res;
  if (action === 'status') {
    if (!['ENABLE', 'DISABLE'].includes(value)) throw new Error('สถานะต้องเป็น ENABLE หรือ DISABLE');
    res = level === 'adgroup'
      ? await tt('POST', '/adgroup/status/update/', { advertiser_id: advertiser, adgroup_ids: [id], operation_status: value })
      : await tt('POST', '/campaign/status/update/', { advertiser_id: advertiser, campaign_ids: [id], operation_status: value });
  } else if (action === 'budget') {
    const b = Number(value);
    if (!(b >= 20 && b <= 100000)) throw new Error('งบต้องอยู่ระหว่าง 20 – 100,000');
    res = level === 'adgroup'
      ? await tt('POST', '/adgroup/update/', { advertiser_id: advertiser, adgroup_id: id, budget: b })
      : await tt('POST', '/campaign/update/', { advertiser_id: advertiser, campaign_id: id, budget: b });
  } else throw new Error('action ไม่รองรับ');
  audit({ advertiser, level, id, action, value, result: res });
  return res;
}

const send = (res, code, obj, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type.startsWith('application/json') ? JSON.stringify(obj) : obj);
};

// Called by listing-studio.js for every request; returns true when the request was ours.
async function handle(req, res, url) {
  if (url.pathname !== PREFIX && !url.pathname.startsWith(PREFIX + '/')) return false;
  try {
    const host = (req.headers.host || '').split(':')[0];
    if (!['127.0.0.1', 'localhost'].includes(host)) { send(res, 403, { error: 'forbidden host' }); return true; }
    const p = url.pathname.slice(PREFIX.length) || '/';
    if (p === '/') { send(res, 200, fs.readFileSync(path.join(__dirname, 'tiktok-ads-live.html'), 'utf8'), 'text/html; charset=utf-8'); return true; }
    if (!TOKEN) { send(res, 500, { error: 'ไม่พบ TIKTOK_ADS_ACCESS_TOKEN ใน server/.env.local' }); return true; }
    if (p === '/api/accounts') { send(res, 200, ADV_IDS.map((id) => ({ id, name: ADV_NAMES[id] || id }))); return true; }
    if (p === '/api/overview') {
      const adv = url.searchParams.get('adv') || ADV_IDS[0];
      if (!ADV_IDS.includes(adv)) { send(res, 400, { error: 'advertiser ไม่ถูกต้อง' }); return true; }
      send(res, 200, await overview(adv, url.searchParams)); return true;
    }
    if (p === '/api/adgroups') {
      const adv = url.searchParams.get('adv');
      if (!ADV_IDS.includes(adv)) { send(res, 400, { error: 'advertiser ไม่ถูกต้อง' }); return true; }
      send(res, 200, await adgroups(adv, url.searchParams.get('campaign'))); return true;
    }
    if (p === '/api/write' && req.method === 'POST') {
      if (req.headers['x-dashboard'] !== '1') { send(res, 403, { error: 'missing header' }); return true; }
      let b = ''; for await (const c of req) b += c;
      send(res, 200, { ok: true, result: await writeOp(JSON.parse(b || '{}')) }); return true;
    }
    if (p === '/api/audit') {
      const lines = fs.existsSync(AUDIT) ? fs.readFileSync(AUDIT, 'utf8').trim().split('\n').slice(-30).reverse().map((l) => JSON.parse(l)) : [];
      send(res, 200, lines); return true;
    }
    send(res, 404, { error: 'not found' });
  } catch (e) { send(res, 500, { error: e.message }); }
  return true;
}

module.exports = { handle };
