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

// "สถานะและข้อมูลเชิงลึก" แบบของเราเอง — TikTok ไม่เปิด API เกรด/คำแนะนำของ Ads Manager
// (/tool/diagnosis/get/ ไม่ได้รับสิทธิ์ และไม่รองรับ GMV Max) จึงคำนวณจากเป้า ROAS / งบ / ยอดใช้จริงในช่วงที่เลือก
const STATUS_TH = { CAMPAIGN_STATUS_ENABLE: 'กำลังส่งโฆษณา', CAMPAIGN_STATUS_DISABLE: 'ปิดอยู่', CAMPAIGN_STATUS_BUDGET_EXCEED: 'งบหมด',
  CAMPAIGN_STATUS_DELETE: 'ถูกลบ', CAMPAIGN_STATUS_ADVERTISER_AUDIT_DENY: 'บัญชีไม่ผ่านตรวจ', CAMPAIGN_STATUS_ADVERTISER_AUDIT: 'บัญชีรอตรวจ',
  CAMPAIGN_STATUS_NOT_DELETE: 'กำลังส่งโฆษณา' };
const RANK = { good: 0, info: 0, mid: 1, bad: 2 };

function insight(r, start, end) {
  const label = STATUS_TH[r.secondary] || (r.status === 'ENABLE' ? 'กำลังส่งโฆษณา' : 'ปิดอยู่');
  if (r.status !== 'ENABLE') return { grade: null, label, notes: [] };
  const notes = [];
  const from = r.created && r.created > start ? r.created : start;
  const days = Math.max(1, Math.round((new Date(end) - new Date(from)) / 864e5) + 1);
  if (!r.spend) notes.push(['bad', 'ไม่มีการใช้จ่ายในช่วงนี้ — โฆษณาอาจไม่ได้ส่งเลย ลองลดเป้า ROAS หรือเช็กสินค้า/วิดีโอใน Ads Manager']);
  if (r.spend && r.roasBid) {
    const ratio = r.roas / r.roasBid;
    if (ratio >= 1) notes.push(['good', `ROAS ถึงเป้า (${r.roas} / เป้า ${r.roasBid})`]);
    else notes.push([ratio >= 0.8 ? 'mid' : 'bad', `ROAS ต่ำกว่าเป้า (${r.roas} / เป้า ${r.roasBid})`]);
  } else if (r.spend) notes.push([r.roas >= 3 ? 'good' : r.roas >= 1.5 ? 'mid' : 'bad', `ROAS ${r.roas}x`]);
  if (r.spend && r.budget && r.budgetMode === 'BUDGET_MODE_DAY') {
    const use = r.spend / days / r.budget * 100, avg = Math.round(r.spend / days);
    if (use < 10) notes.push(['mid', `ใช้งบแค่ ${use.toFixed(1)}% (เฉลี่ย ฿${avg}/วัน จากงบ ฿${r.budget}) — ระบบหาคนซื้อที่ ROAS เป้านี้ได้น้อย ถ้าอยากได้ยอดเพิ่ม ลองลดเป้า ROAS`]);
    else if (use > 90) notes.push([r.roas >= 3 ? 'good' : 'mid', `ใช้งบเกือบเต็ม (${use.toFixed(0)}%) — ${r.roas >= 3 ? 'ROAS ดี เพิ่มงบได้' : 'งบอาจจำกัดยอดขาย'}`]);
    else notes.push(['info', `ใช้งบ ${use.toFixed(0)}% (เฉลี่ย ฿${avg}/วัน)`]);
  }
  if (r.orders && r.cpa) notes.push(['info', `ต้นทุน ฿${r.cpa}/ออเดอร์`]);
  if (r.roiProtection) notes.push(['info', 'ROI protection เปิดอยู่ (TikTok ชดเชยถ้า ROI ต่ำกว่าเป้ามาก)']);
  const worst = Math.max(0, ...notes.map(([lv]) => RANK[lv]));
  return { grade: ['ดี', 'ปานกลาง', 'ควรแก้'][worst], level: ['good', 'mid', 'bad'][worst], label, notes: notes.map(([level, text]) => ({ level, text })) };
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
      const info = {};
      await Promise.all(gmv.list.filter((c) => c.operation_status === 'ENABLE').map(async (c) => {
        try { info[c.campaign_id] = await tt('GET', '/campaign/gmv_max/info/', { advertiser_id: adv, campaign_id: c.campaign_id }); } catch { /* งบไม่ขึ้นก็ยังแสดงแถว */ }
      }));
      for (const c of gmv.list) {
        const i = info[c.campaign_id];
        rows.push({ id: c.campaign_id, name: c.campaign_name, status: c.operation_status, secondary: c.secondary_status,
          objective: c.objective_type, budgetMode: i ? 'BUDGET_MODE_DAY' : 'UNKNOWN', budget: i ? num(i.budget) : 0, type: 'GMV_MAX',
          created: (c.create_time || '').slice(0, 10), roasBid: i ? num(i.roas_bid) : 0,
          roiProtection: c.roi_protection_compensation_status === 'IN_EFFECT' || !!(i && i.roi_protection_enabled),
          ...finish({ ...zero, ...(rep.camp[c.campaign_id] || {}) }) });
      }
      for (const [date, m] of Object.entries(rep.daily)) daily.push({ date, ...m });
    } catch (e) { gmvError = e.message; }
  }
  for (const r of rows) r.insight = insight(r, start, end);
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
  if (level === 'gmv_max') {
    // GMV Max: งบ/เป้า ROAS ผ่าน /campaign/gmv_max/update/ (ทดสอบแล้ว) · เปิด/ปิดใช้ /campaign/status/update/ ตัวเดียวกับแคมเปญปกติ
    if (action === 'status') {
      if (!['ENABLE', 'DISABLE'].includes(value)) throw new Error('สถานะต้องเป็น ENABLE หรือ DISABLE');
      res = await tt('POST', '/campaign/status/update/', { advertiser_id: advertiser, campaign_ids: [id], operation_status: value });
    } else if (action === 'budget') {
      const b = Number(value);
      if (!(b >= 20 && b <= 100000)) throw new Error('งบต้องอยู่ระหว่าง 20 – 100,000');
      res = await tt('POST', '/campaign/gmv_max/update/', { advertiser_id: advertiser, campaign_id: id, budget: b });
    } else if (action === 'roas_bid') {
      const r = Number(value);
      if (!(r >= 1 && r <= 50)) throw new Error('เป้า ROAS ต้องอยู่ระหว่าง 1 – 50');
      res = await tt('POST', '/campaign/gmv_max/update/', { advertiser_id: advertiser, campaign_id: id, roas_bid: r });
    } else throw new Error('action ไม่รองรับ');
    res = { campaign_id: res.campaign_id, budget: res.budget, roas_bid: res.roas_bid, operation_status: res.operation_status, campaign_ids: res.campaign_ids };
  } else if (action === 'status') {
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
  audit({ advertiser, level, id, action, value, by: body.by || 'dashboard', result: res });
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

// ใช้ร่วมกับบอทดูแลโฆษณา (scripts/tiktok-ads-bot.js ที่ Hermes รัน)
module.exports = { handle, tt, listAll, overview, gmvMaxCampaigns, gmvMaxReport, insight, finish, writeOp, chunks,
  ADV_IDS, ADV_NAMES, AUDIT, hasToken: () => !!TOKEN };
