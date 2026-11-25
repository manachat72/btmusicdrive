#!/usr/bin/env node
/**
 * TikTok Ads bot — ตัวช่วยของ Hermes (สกิล tiktok-ads-manager) ดูแลแคมเปญ GMV Max ของร้าน
 *
 *   node scripts/tiktok-ads-bot.js report              ดึงข้อมูลสด → JSON ให้ AI อ่าน (cron 09/12/15/18 น.)
 *   node scripts/tiktok-ads-bot.js propose '<json>'    AI ลงทะเบียนข้อเสนอ → ได้รหัส P1, P2… ไว้ให้ผู้ใช้อนุมัติ
 *   node scripts/tiktok-ads-bot.js apply P1 [P2…|all]  ผู้ใช้อนุมัติใน Telegram แล้ว → สั่ง TikTok จริง
 *   node scripts/tiktok-ads-bot.js reject P1 [all]     ผู้ใช้ไม่อนุมัติ
 *   node scripts/tiktok-ads-bot.js pending             ดูข้อเสนอที่รออนุมัติ
 *   node scripts/tiktok-ads-bot.js brief '<json>'      บันทึกโจทย์ปรับ/ทำวิดีโอใหม่ ให้เอเจนต์ทำวิดีโอรับไปทำต่อ
 *
 * ความปลอดภัย: AI สั่ง TikTok ตรง ๆ ไม่ได้ — ทุกการเปลี่ยนต้องผ่าน propose (ตรวจกรอบ) แล้วรอ apply จากคำอนุมัติของผู้ใช้
 * กรอบ (GUARD) ตรวจซ้ำอีกรอบตอน apply เทียบค่าปัจจุบันสดจาก TikTok · ทุกคำสั่งลง .ads-bot/audit.jsonl
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, '.ads-bot');
fs.mkdirSync(DIR, { recursive: true });
const BOT_AUDIT = path.join(DIR, 'audit.jsonl');
const STUDIO_AUDIT = path.resolve(ROOT, '..', 'tiktok-ads-analysis', 'data', 'dashboard-audit.jsonl');
process.env.TIKTOK_AUDIT_LOG = BOT_AUDIT; // ต้องตั้งก่อน require
const ads = require('./lib/tiktok-ads-live');

const STATE = path.join(DIR, 'state.json');
const BRIEFS = path.join(DIR, 'video-briefs.jsonl');
const ADV = process.env.TIKTOK_BOT_ADV || '7442465076160282640'; // buythrrmshop
const GUARD = {
  budgetMin: 200, budgetMax: 10000, budgetMaxChangePct: 30,
  roasMin: 2, roasMax: 30, roasMaxStep: 2,
  cooldownHours: 24,      // แคมเปญ+ประเภทคำสั่งเดียวกัน ห้ามเปลี่ยนซ้ำภายใน 24 ชม. (GMV Max ต้องใช้เวลาเรียนรู้)
  proposalTtlHours: 6,
};
const ACT_TH = { budget: 'งบ/วัน', roas_bid: 'เป้า ROAS', status: 'สถานะ' };

const num = (v) => Number(v) || 0;
const r2 = (v) => Math.round(v * 100) / 100;
// วันที่ตามเวลาไทย (บัญชีโฆษณาใช้ Asia/Bangkok) — container เป็น UTC
const ictDate = (offsetDays = 0) => new Date(Date.now() + 7 * 36e5 + offsetDays * 864e5).toISOString().slice(0, 10);
const ictNow = () => new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 16).replace('T', ' ');

function loadState() { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return { seq: 0, proposals: [] }; } }
function saveState(s) { fs.writeFileSync(STATE + '.tmp', JSON.stringify(s, null, 1)); fs.renameSync(STATE + '.tmp', STATE); }
function expire(s) {
  const now = Date.now();
  for (const p of s.proposals) if (p.status === 'pending' && now > Date.parse(p.expiresAt)) p.status = 'expired';
  s.proposals = s.proposals.filter((p) => p.status === 'pending' || now - Date.parse(p.createdAt) < 14 * 864e5);
}
function readAudit(file) {
  try { return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
}
function recentActions(hours) {
  const since = Date.now() - hours * 36e5;
  return [...readAudit(BOT_AUDIT), ...readAudit(STUDIO_AUDIT)]
    .filter((a) => Date.parse(a.at) >= since && a.action)
    .map((a) => ({ at: a.at, by: a.by || 'dashboard', campaign_id: String(a.id), action: a.action, value: a.value, note: a.note }));
}

async function gmvInfo(id) { return ads.tt('GET', '/campaign/gmv_max/info/', { advertiser_id: ADV, campaign_id: id }); }

function metrics(m) {
  const spend = r2(num(m.spend)), revenue = r2(num(m.revenue)), orders = num(m.orders);
  return { spend, revenue, orders, roas: spend ? r2(revenue / spend) : 0, cpa: orders ? r2(spend / orders) : 0 };
}

async function creatives(c, info, start, end, storeIds) {
  const groups = info.item_group_ids || [];
  if (!groups.length) return [];
  const list = await ads.listAll('/gmv_max/report/get/', {
    advertiser_id: ADV, store_ids: storeIds, start_date: start, end_date: end,
    dimensions: ['campaign_id', 'item_id'], filtering: { campaign_ids: [c.campaign_id], item_group_ids: groups },
    metrics: ['cost', 'orders', 'gross_revenue', 'product_impressions', 'product_clicks', 'ad_video_view_rate_2s', 'ad_video_view_rate_6s', 'creative_delivery_status'],
  });
  return list.map((x) => {
    const m = x.metrics, spend = num(m.cost), rev = num(m.gross_revenue), imp = num(m.product_impressions), clk = num(m.product_clicks);
    const v = { item_id: x.dimensions.item_id, status: m.creative_delivery_status, spend: r2(spend), revenue: r2(rev), orders: num(m.orders),
      roas: spend ? r2(rev / spend) : 0, impressions: imp, ctr: imp ? r2(clk / imp * 100) : 0,
      view2s: num(m.ad_video_view_rate_2s), view6s: num(m.ad_video_view_rate_6s), flags: [] };
    if (v.item_id === '-1') v.flags.push('ไม่ใช่วิดีโอ (การ์ดสินค้า)');
    if (v.status === 'AUTHORIZATION_NEEDED') v.flags.push('สิทธิ์ใช้คลิปหมด — ต้องขอรหัสอนุญาตใหม่');
    if (v.status === 'NOT_DELIVERYING' && v.spend > 0) v.flags.push('หยุดส่งแล้ว');
    if (v.impressions >= 300 && v.view6s > 0 && v.view6s < 15) v.flags.push('hook อ่อน (ดูถึง 6 วิ < 15%)');
    if (v.spend >= 100 && v.roas < 3) v.flags.push('ROAS ต่ำ');
    return v;
  }).sort((a, b) => b.spend - a.spend || b.revenue - a.revenue);
}

async function report() {
  if (!ads.hasToken()) throw new Error('ไม่พบ TIKTOK_ADS_ACCESS_TOKEN ใน server/.env.local');
  const { list, storeIds } = await ads.gmvMaxCampaigns(ADV);
  const win = { today: [ictDate(0), ictDate(0)], yesterday: [ictDate(-1), ictDate(-1)], d7: [ictDate(-6), ictDate(0)], d30: [ictDate(-29), ictDate(0)] };
  const reps = {};
  for (const [k, [s, e]] of Object.entries(win)) reps[k] = (await ads.gmvMaxReport(ADV, storeIds, s, e)).camp;
  const pick = (k, id) => metrics(reps[k][id] || {});
  const enabled = list.filter((c) => c.operation_status === 'ENABLE');
  const actions = recentActions(7 * 24);
  const campaigns = [];
  for (const c of enabled) {
    const info = await gmvInfo(c.campaign_id);
    const row = { campaign_id: c.campaign_id, name: c.campaign_name, status: c.operation_status, delivery: c.secondary_status,
      budget: num(info.budget), roas_bid: num(info.roas_bid), roi_protection: !!info.roi_protection_enabled,
      created: (c.create_time || '').slice(0, 10),
      today: pick('today', c.campaign_id), yesterday: pick('yesterday', c.campaign_id), last7d: pick('d7', c.campaign_id), last30d: pick('d30', c.campaign_id) };
    row.budget_use_7d_pct = row.budget ? r2(row.last7d.spend / 7 / row.budget * 100) : null;
    const ins = ads.insight({ ...ads.finish({ spend: row.last7d.spend, revenue: row.last7d.revenue, orders: row.last7d.orders, impressions: 0, clicks: 0 }),
      status: 'ENABLE', secondary: c.secondary_status, budget: row.budget, budgetMode: 'BUDGET_MODE_DAY', roasBid: row.roas_bid,
      roiProtection: row.roi_protection, created: row.created }, win.d7[0], win.d7[1]);
    row.insight_7d = { grade: ins.grade, notes: ins.notes.map((n) => n.text) };
    row.recent_changes = actions.filter((a) => a.campaign_id === c.campaign_id);
    row.videos_7d = await creatives(c, info, win.d7[0], win.d7[1], storeIds);
    campaigns.push(row);
  }
  const paused = list.filter((c) => c.operation_status !== 'ENABLE')
    .map((c) => ({ campaign_id: c.campaign_id, name: c.campaign_name, last30d: pick('d30', c.campaign_id) }))
    .filter((c) => c.last30d.revenue > 0)
    .sort((a, b) => b.last30d.revenue - a.last30d.revenue).slice(0, 20);
  const manualOn = (await ads.listAll('/campaign/get/', { advertiser_id: ADV })).filter((c) => c.operation_status === 'ENABLE').map((c) => c.campaign_name);
  const s = loadState(); expire(s); saveState(s);
  return {
    now_th: ictNow(), account: `${ads.ADV_NAMES[ADV] || ADV} (${ADV})`, currency: 'THB',
    note: 'today = ข้อมูลวันนี้ถึงตอนนี้ (ยังไม่ครบวัน) · ROAS = ยอดขาย ÷ ค่าโฆษณา · roas_bid = เป้า ROAS ที่ตั้งใน GMV Max',
    guardrails: GUARD,
    active_gmv_max: campaigns,
    paused_with_recent_sales_30d: paused,
    manual_campaigns_enabled: manualOn,
    pending_proposals: s.proposals.filter((p) => p.status === 'pending'),
    recent_changes_7d: actions,
  };
}

function checkGuard(p, info, actions) {
  const cur = { budget: num(info.budget), roas_bid: num(info.roas_bid), status: info.operation_status };
  if (p.action === 'budget') {
    const v = Number(p.value);
    if (!(v >= GUARD.budgetMin && v <= GUARD.budgetMax)) return `งบต้องอยู่ระหว่าง ${GUARD.budgetMin}–${GUARD.budgetMax}`;
    if (cur.budget && Math.abs(v - cur.budget) / cur.budget * 100 > GUARD.budgetMaxChangePct + 1e-9) return `เปลี่ยนงบเกิน ${GUARD.budgetMaxChangePct}% (ปัจจุบัน ${cur.budget})`;
    if (v === cur.budget) return 'งบเท่าเดิม';
  } else if (p.action === 'roas_bid') {
    const v = Number(p.value);
    if (!(v >= GUARD.roasMin && v <= GUARD.roasMax)) return `เป้า ROAS ต้องอยู่ระหว่าง ${GUARD.roasMin}–${GUARD.roasMax}`;
    if (Math.abs(v - cur.roas_bid) > GUARD.roasMaxStep + 1e-9) return `ขยับเป้า ROAS ได้ครั้งละไม่เกิน ${GUARD.roasMaxStep} (ปัจจุบัน ${cur.roas_bid})`;
    if (v === cur.roas_bid) return 'เป้า ROAS เท่าเดิม';
  } else if (p.action === 'status') {
    if (!['ENABLE', 'DISABLE'].includes(p.value)) return 'สถานะต้องเป็น ENABLE หรือ DISABLE';
    if (p.value === cur.status) return `สถานะเป็น ${cur.status} อยู่แล้ว`;
  } else return `action "${p.action}" ไม่รองรับ (ใช้ budget / roas_bid / status · เรื่องวิดีโอใช้คำสั่ง brief)`;
  const recent = actions.find((a) => a.campaign_id === String(p.campaign_id) && a.action === p.action && !/no-op/.test(a.note || ''));
  if (recent) return `เพิ่งเปลี่ยน${ACT_TH[p.action]}ไปเมื่อ ${recent.at.slice(0, 16)} — รอให้ครบ ${GUARD.cooldownHours} ชม. ก่อน`;
  return { from: cur[p.action] };
}

function parseArg(a) {
  if (!a) throw new Error('ต้องส่ง JSON มาด้วย');
  const txt = fs.existsSync(a) ? fs.readFileSync(a, 'utf8') : a;
  const j = JSON.parse(txt);
  return Array.isArray(j) ? j : [j];
}
const fmtVal = (a, v) => a === 'budget' ? `฿${num(v).toLocaleString('en-US')}` : a === 'status' ? (v === 'ENABLE' ? 'เปิด' : 'ปิด') : String(v);

async function propose(arg) {
  const items = parseArg(arg), s = loadState(); expire(s);
  const actions = recentActions(GUARD.cooldownHours), out = [];
  for (const it of items) {
    const id = String(it.campaign_id || '');
    try {
      if (!/^\d+$/.test(id)) throw new Error('campaign_id ไม่ถูกต้อง');
      if (!it.reason) throw new Error('ต้องมีเหตุผล (reason)');
      const info = await gmvInfo(id);
      const g = checkGuard(it, info, actions);
      if (typeof g === 'string') throw new Error(g);
      if (s.proposals.some((p) => p.status === 'pending' && p.campaign_id === id && p.action === it.action)) throw new Error('มีข้อเสนอแบบเดียวกันรออนุมัติอยู่แล้ว');
      const p = { id: 'P' + (++s.seq), status: 'pending', campaign_id: id, name: info.campaign_name, action: it.action, from: g.from, value: it.action === 'status' ? it.value : Number(it.value),
        reason: String(it.reason).slice(0, 400), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + GUARD.proposalTtlHours * 36e5).toISOString() };
      s.proposals.push(p);
      out.push(`✅ ${p.id} · ${p.name} · ${ACT_TH[p.action]} ${fmtVal(p.action, p.from)} → ${fmtVal(p.action, p.value)}\n   เหตุผล: ${p.reason}`);
    } catch (e) { out.push(`⛔ ไม่รับข้อเสนอ ${id || '?'} ${it.action || ''}: ${e.message}`); }
  }
  saveState(s);
  return out.join('\n') + `\n\n(ข้อเสนอหมดอายุใน ${GUARD.proposalTtlHours} ชม. · ตอบ "อนุมัติ P1" / "อนุมัติทั้งหมด" / "ไม่ P1")`;
}

function select(s, ids) {
  const pend = s.proposals.filter((p) => p.status === 'pending');
  if (!ids.length) throw new Error('ระบุรหัสข้อเสนอ เช่น P1 หรือ all');
  if (ids.some((x) => /^(all|ทั้งหมด)$/i.test(x))) return pend;
  const want = new Set(ids.map((x) => x.toUpperCase()));
  const found = s.proposals.filter((p) => want.has(p.id));
  for (const w of want) if (!found.some((p) => p.id === w)) throw new Error(`ไม่พบข้อเสนอ ${w}`);
  return found;
}

async function apply(ids) {
  const s = loadState(); expire(s);
  const out = [];
  for (const p of select(s, ids)) {
    if (p.status !== 'pending') { out.push(`⏭ ${p.id} ข้าม (สถานะ ${p.status})`); continue; }
    try {
      const info = await gmvInfo(p.campaign_id);
      const g = checkGuard(p, info, recentActions(GUARD.cooldownHours));
      if (typeof g === 'string') throw new Error('ค่าปัจจุบันเปลี่ยนไปแล้ว: ' + g);
      const res = await ads.writeOp({ advertiser: ADV, level: 'gmv_max', id: p.campaign_id, action: p.action, value: p.value, by: 'hermes-bot' });
      p.status = 'applied'; p.appliedAt = new Date().toISOString(); p.result = res;
      out.push(`✅ ${p.id} ทำแล้ว · ${p.name} · ${ACT_TH[p.action]} ${fmtVal(p.action, g.from)} → ${fmtVal(p.action, p.value)}`);
    } catch (e) { p.status = 'failed'; p.error = e.message; out.push(`❌ ${p.id} ไม่สำเร็จ: ${e.message}`); }
  }
  saveState(s);
  return out.join('\n') || 'ไม่มีข้อเสนอให้ทำ';
}

function reject(ids) {
  const s = loadState(); expire(s);
  const out = select(s, ids).filter((p) => p.status === 'pending').map((p) => { p.status = 'rejected'; p.rejectedAt = new Date().toISOString(); return `🚫 ${p.id} ยกเลิกแล้ว · ${p.name} · ${ACT_TH[p.action]}`; });
  saveState(s);
  return out.join('\n') || 'ไม่มีข้อเสนอที่รออนุมัติ';
}

function pending() {
  const s = loadState(); expire(s); saveState(s);
  const p = s.proposals.filter((x) => x.status === 'pending');
  return p.length ? p.map((x) => `${x.id} · ${x.name} · ${ACT_TH[x.action]} ${fmtVal(x.action, x.from)} → ${fmtVal(x.action, x.value)} (หมดอายุ ${new Date(Date.parse(x.expiresAt) + 7 * 36e5).toISOString().slice(11, 16)} น.)\n   ${x.reason}`).join('\n') : 'ไม่มีข้อเสนอที่รออนุมัติ';
}

function brief(arg) {
  const items = parseArg(arg);
  for (const b of items) fs.appendFileSync(BRIEFS, JSON.stringify({ at: new Date().toISOString(), status: 'open', ...b }) + '\n');
  return `📝 บันทึกโจทย์วิดีโอ ${items.length} รายการ → .ads-bot/video-briefs.jsonl`;
}

(async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    let out;
    if (cmd === 'report') out = JSON.stringify(await report(), null, 1);
    else if (cmd === 'propose') out = await propose(rest[0]);
    else if (cmd === 'apply') out = await apply(rest);
    else if (cmd === 'reject') out = reject(rest);
    else if (cmd === 'pending') out = pending();
    else if (cmd === 'brief') out = brief(rest[0]);
    else { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 12).join('\n')); process.exit(cmd ? 1 : 0); }
    console.log(out);
  } catch (e) { console.error('ERROR: ' + e.message); process.exit(1); }
})();
