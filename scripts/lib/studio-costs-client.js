/* ───────── ต้นทุนสินค้า — ต่อท้าย studio-client.js (ใช้ adsFmt/esc/html) ─────────
 * ชั้นบน: การ์ดสรุป · กลาง: แถบต้นทุน/กำไรทุกสินค้า (ซ้าย) + กลุ่มควรขึ้น/ควรลด (ขวา) · ล่าง: รายการพร้อมรูปปก กดดูเหตุผล */
var costData = null, costSort = 'margin', costDir = 1, costFilter = 'all', costFloor = 60, costDays = 90, costQ = '', costOpen = {};
var COST_C = { cost: '#d97706', profit: '#10b981', up: '#047857', down: '#b91c1c', hold: '#6b7280', muted: '#6b7280', line: '#e5e7eb' };

function renderCosts() {
  html('<div class="page-heading"><div><h1>ต้นทุนสินค้า</h1><p>กำลังโหลด…</p></div></div>');
  fetch('/api/product-costs?days=' + costDays + '&floor=' + costFloor).then(function (r) { return r.json(); }).then(function (d) {
    if (d.error) { html('<div class="page-heading"><div><h1>ต้นทุนสินค้า</h1><p>✗ ' + esc(d.error) + '</p></div></div>'); return; }
    costData = d; drawCosts();
  }).catch(function (e) { html('<div class="page-heading"><div><h1>ต้นทุนสินค้า</h1><p>✗ ' + esc(e.message) + '</p></div></div>'); });
}

function sortCosts(k) { costDir = costSort === k ? -costDir : 1; costSort = k; drawCosts(); }
function costVal(r, k) { return k === 'action' ? { up: 0, down: 1, hold: 2 }[r.action] : r[k]; }
function costToggle(id) { costOpen[id] = !costOpen[id]; drawCosts(); }
// ชื่อสั้นสำหรับแถบกราฟ — ตัดคำนำหน้าที่ซ้ำกันทุกสินค้า
function costShort(n) { return String(n).replace(/^\s*USB\s*(แฟลชไดร\S*|Flash\s*Drive)?\s*(MP3)?\s*[-–:]?\s*/i, '').replace(/^(รวมเพลง|เพลง)\s*/, '').slice(0, 38); }
function costImg(u) { return !u ? '' : /^https?:/.test(u) ? u : 'https://btmusicdrive.com/' + String(u).replace(/^\//, ''); }

function costCard(label, value, sub, tone) {
  var bg = tone === 'up' ? '#ecfdf5' : tone === 'down' ? '#fef2f2' : '#f6f7f8', fg = tone ? COST_C[tone] : '#242424';
  return '<div style="background:' + bg + ';border-radius:10px;padding:12px 14px"><div style="font-size:12px;color:' + (tone ? fg : COST_C.muted) + '">' + label + '</div>' +
    '<div style="font-size:24px;font-weight:600;color:' + fg + '">' + value + '</div>' + (sub ? '<div style="font-size:11px;color:' + COST_C.muted + '">' + sub + '</div>' : '') + '</div>';
}

function drawCosts() {
  var d = costData, f = adsFmt, b = function (n) { return '฿' + f(n); };
  var usb = d.rows.filter(function (r) { return !r.accessory; });
  var avgProfit = usb.reduce(function (s, r) { return s + r.profit; }, 0) / (usb.length || 1);
  var avgMargin = usb.reduce(function (s, r) { return s + r.margin; }, 0) / (usb.length || 1);
  var sold = d.rows.reduce(function (s, r) { return s + r.sold; }, 0);

  var match = function (r) {
    return (costFilter === 'all' || r.action === costFilter || r.cap === costFilter) && (!costQ || (r.name + ' ' + r.sku).toLowerCase().indexOf(costQ.toLowerCase()) >= 0);
  };
  var rows = d.rows.filter(match).sort(function (a, c) {
    var x = costVal(a, costSort), y = costVal(c, costSort);
    return (typeof x === 'string' ? x.localeCompare(y) : x - y) * costDir;
  });

  // ── การ์ดสรุป ──
  var cards = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px">' +
    costCard('กำไรเฉลี่ยต่อชิ้น', b(avgProfit), 'ก่อนหักค่าส่ง/กล่อง/ค่าธรรมเนียม') +
    costCard('กำไรเฉลี่ย', avgMargin.toFixed(0) + '%', 'เกณฑ์ขั้นต่ำ ' + d.floor + '%') +
    costCard('ขายได้ (เว็บ)', f(sold) + ' ชิ้น', d.days + ' วันล่าสุด') +
    costCard('▲ ควรขึ้นราคา', f(d.counts.up), 'รายการ', 'up') +
    costCard('▼ ควรลดราคา', f(d.counts.down), 'รายการ', 'down') + '</div>';

  // ── แถบต้นทุน/กำไร (ความยาวแถบเทียบราคาแพงสุด จะได้เห็นขนาดเงินจริง ไม่ใช่แค่ %) ──
  var maxPrice = Math.max.apply(null, rows.map(function (r) { return r.price; }).concat([1]));
  var bars = rows.map(function (r) {
    var w = r.price / maxPrice * 100, cw = r.accessory ? 0 : Math.min(r.cost, r.price) / r.price * w, pw = w - cw;
    var tag = r.action === 'up' ? '<span style="color:' + COST_C.up + '">▲</span> ' : r.action === 'down' ? '<span style="color:' + COST_C.down + '">▼</span> ' : '';
    return '<div style="display:grid;grid-template-columns:minmax(0,190px) minmax(0,1fr) 46px;gap:8px;align-items:center;padding:3px 0;cursor:pointer" onclick="costToggle(\'' + r.id + '\');document.getElementById(\'cost-' + r.id + '\').scrollIntoView({block:\'center\'})" title="' + esc(r.name) + ' · ' + b(r.price) + ' · ทุน ' + (r.accessory ? '?' : b(r.cost)) + '">' +
      '<span style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + tag + esc(costShort(r.name)) + ' <span style="color:' + COST_C.muted + '">' + esc(r.cap) + '</span></span>' +
      '<div style="display:flex;height:14px;border-radius:3px;overflow:hidden;background:#f3f4f6"><div style="width:' + cw + '%;background:' + COST_C.cost + '"></div><div style="width:' + pw + '%;background:' + (r.accessory ? '#d1d5db' : COST_C.profit) + '"></div></div>' +
      '<span style="text-align:right;font-size:12px;color:' + (r.margin < d.floor && !r.accessory ? COST_C.down : '#242424') + '">' + (r.accessory ? '?' : r.margin.toFixed(0) + '%') + '</span></div>';
  }).join('');
  var legend = '<div style="display:flex;gap:12px;font-size:11px;color:' + COST_C.muted + ';margin-bottom:8px">' +
    '<span><i style="display:inline-block;width:9px;height:9px;background:' + COST_C.cost + ';border-radius:2px"></i> ต้นทุน</span>' +
    '<span><i style="display:inline-block;width:9px;height:9px;background:' + COST_C.profit + ';border-radius:2px"></i> กำไร</span>' +
    '<span>ความยาวแถบ = ราคาขาย · กดแถบเพื่อดูรายละเอียด</span></div>';

  // ── กลุ่มควรขึ้น / ควรลด ──
  var group = function (act, title) {
    var list = d.rows.filter(function (r) { return r.action === act; });
    var body = list.length ? list.map(function (r) {
      return '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid ' + COST_C.line + ';font-size:12px">' +
        '<span style="min-width:0"><b style="font-weight:500">' + esc(costShort(r.name)) + '</b> <span style="color:' + COST_C.muted + '">' + esc(r.cap) + '</span><br><span style="color:' + COST_C.muted + '">' + esc(r.reason) + '</span></span>' +
        '<span style="white-space:nowrap">' + b(r.price) + ' → <b style="color:' + COST_C[act] + '">' + b(r.suggest) + '</b></span></div>';
    }).join('') : '<div style="font-size:12px;color:' + COST_C.muted + ';padding:6px 0;border-top:1px solid ' + COST_C.line + '">ไม่มีรายการ</div>';
    return '<div class="card" style="margin:0;border:1px solid ' + COST_C[act] + '33"><div style="font-weight:600;color:' + COST_C[act] + ';margin-bottom:6px">' + title + ' (' + list.length + ')</div>' + body + '</div>';
  };
  var caps = {}; usb.forEach(function (r) { (caps[r.cap] = caps[r.cap] || []).push(r); });
  var capBox = '<div class="card" style="margin:0"><div style="font-weight:600;margin-bottom:6px">ตามความจุ</div>' + Object.keys(caps).map(function (c) {
    var l = caps[c], g = d.groups[c];
    return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-top:1px solid ' + COST_C.line + ';font-size:12px"><span>' + esc(c) + ' <span style="color:' + COST_C.muted + '">· ' + l.length + ' รายการ</span></span>' +
      '<span>ทุน ' + b(l[0].cost) + ' · ราคากลาง ' + b(g.price) + ' · กำไร ' + b(g.price - l[0].cost) + '</span></div>';
  }).join('') + '</div>';

  // ── ตัวกรอง ──
  var chip = function (k, t) { return '<button type="button" class="' + (costFilter === k ? 'primary' : 'ghost') + ' compact" onclick="costFilter=\'' + k + '\';drawCosts()">' + t + '</button>'; };
  var sortBtn = function (k, t) { return '<button type="button" class="' + (costSort === k ? 'primary' : 'ghost') + ' compact" onclick="sortCosts(\'' + k + '\')">' + t + (costSort === k ? (costDir === 1 ? ' ▲' : ' ▼') : '') + '</button>'; };
  var filters = '<div class="card" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
    chip('all', 'ทั้งหมด ' + d.rows.length) + chip('up', '▲ ควรขึ้น') + chip('down', '▼ ควรลด') + chip('hold', 'คงราคา') +
    '<span style="width:8px"></span>' + Object.keys(d.groups).map(function (c) { return chip(c, c); }).join('') +
    '<span style="width:8px"></span><span style="font-size:12px;color:' + COST_C.muted + '">เรียง</span>' + sortBtn('margin', 'กำไร %') + sortBtn('profit', 'กำไร/ชิ้น') + sortBtn('sold', 'ขายได้') + sortBtn('price', 'ราคา') + sortBtn('sku', 'SKU') +
    '<input id="costQ" placeholder="ค้นหาชื่อ/SKU" value="' + esc(costQ) + '" oninput="costQ=this.value;drawCosts();var e=$(\'costQ\');e.focus();e.setSelectionRange(1e4,1e4)" style="margin-left:auto;max-width:170px"></div>';

  // ── รายการพร้อมรูปปก ──
  var list = rows.map(function (r) {
    var open = costOpen[r.id], act = { up: '▲ ควรขึ้น → ' + b(r.suggest), down: '▼ ควรลด → ' + b(r.suggest), hold: 'คงราคา' }[r.action];
    return '<div id="cost-' + r.id + '" style="border-top:1px solid ' + COST_C.line + ';padding:8px 0' + (open ? ';background:#fafaf9' : '') + '">' +
      '<div onclick="costToggle(\'' + r.id + '\')" style="display:grid;grid-template-columns:48px minmax(0,1fr) 80px 80px 90px 150px;gap:10px;align-items:center;cursor:pointer;font-size:13px">' +
      (r.image ? '<img src="' + esc(costImg(r.image)) + '" alt="" loading="lazy" style="width:48px;height:48px;object-fit:cover;border-radius:6px;background:#f3f4f6">' : '<div style="width:48px;height:48px;border-radius:6px;background:#f3f4f6"></div>') +
      '<div style="min-width:0"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(r.name) + '</div><div style="font-size:11px;color:' + COST_C.muted + '">' + esc(r.sku) + ' · ' + esc(r.cap) + '</div></div>' +
      '<div style="text-align:right"><div style="font-size:11px;color:' + COST_C.muted + '">ราคา</div>' + b(r.price) + '</div>' +
      '<div style="text-align:right"><div style="font-size:11px;color:' + COST_C.muted + '">ทุน</div>' + (r.accessory ? '?' : b(r.cost)) + '</div>' +
      '<div style="text-align:right"><div style="font-size:11px;color:' + COST_C.muted + '">กำไร/ชิ้น</div><span style="color:' + (r.profit < 0 ? COST_C.down : COST_C.up) + '">' + (r.accessory ? '?' : '+' + b(r.profit)) + '</span></div>' +
      '<div style="text-align:right;color:' + COST_C[r.action] + ';font-size:12px">' + act + '</div></div>' +
      (open ? '<div style="margin:8px 0 2px 58px;font-size:12px;color:#374151;display:flex;gap:16px;flex-wrap:wrap">' +
        '<span>กำไร ' + (r.accessory ? '?' : r.margin.toFixed(1) + '%') + '</span><span>ขายได้ (เว็บ) ' + f(r.sold) + ' ชิ้น / ' + d.days + ' วัน</span>' +
        '<span>ราคากลาง ' + esc(r.cap) + ' ' + b(r.groupPrice) + '</span>' + (r.listPrice ? '<span>ราคาก่อนลด ' + b(r.listPrice) + '</span>' : '') +
        '<span style="flex-basis:100%;color:' + COST_C.muted + '">เหตุผล: ' + esc(r.reason) + '</span>' +
        (r.slug ? '<a href="https://btmusicdrive.com/product/' + encodeURIComponent(r.slug) + '" target="_blank" rel="noreferrer">เปิดหน้าสินค้า ↗</a>' : '') + '</div>' : '') +
      '</div>';
  }).join('');

  html('<div class="page-heading"><div><h1>ต้นทุนสินค้า</h1><p>ราคาขายเทียบราคาทุนตามความจุ พร้อมคำแนะนำขึ้น/ลดราคา · อ่านอย่างเดียว ไม่แก้ราคาให้เอง</p></div>' +
    '<div class="page-heading-actions"><button type="button" class="ghost compact" onclick="downloadCostsCsv()">⬇ ดาวน์โหลด CSV</button></div></div>' +
    cards +
    '<div style="display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:14px;align-items:start;margin-bottom:14px">' +
    '<div class="card" style="margin:0"><div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-weight:600">ต้นทุน vs กำไร ทุกสินค้า</b><span style="font-size:11px;color:' + COST_C.muted + '">' + rows.length + ' รายการ</span></div>' + legend + bars + '</div>' +
    '<div style="display:flex;flex-direction:column;gap:12px">' + group('up', '▲ ควรขึ้นราคา') + group('down', '▼ ควรลดราคา') + capBox + '</div></div>' +
    filters +
    '<div class="card" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:13px">' +
    '<label>กำไรขั้นต่ำ % <input type="number" min="10" max="95" value="' + costFloor + '" style="width:64px" onchange="costFloor=this.value;renderCosts()"></label>' +
    '<label>ดูยอดขายย้อนหลัง (วัน) <input type="number" min="7" max="730" value="' + costDays + '" style="width:64px" onchange="costDays=this.value;renderCosts()"></label>' +
    '<span style="color:' + COST_C.muted + '">ยังไม่รวมค่าส่งที่ร้านออก ค่ากล่อง/ปก และค่าธรรมเนียม · "ขายได้" นับเฉพาะออเดอร์เว็บ ไม่รวม TikTok Shop/Shopee</span></div>' +
    '<div class="card"><b style="font-weight:600">รายละเอียดทุกสินค้า</b> <span style="font-size:12px;color:' + COST_C.muted + '">กดแถวเพื่อดูเหตุผล</span>' + list + '</div>');
}

function downloadCostsCsv() {
  var h = ['SKU', 'ชื่อสินค้า', 'ความจุ', 'ราคาขาย', 'ต้นทุน', 'กำไรต่อชิ้น', 'กำไร %', 'ขายได้', 'คำแนะนำ', 'ราคาแนะนำ', 'เหตุผล'];
  var q = function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; };
  var lines = [h.map(q).join(',')].concat(costData.rows.map(function (r) {
    return [r.sku, r.name, r.cap, r.price, r.accessory ? '' : r.cost, r.accessory ? '' : r.profit, r.accessory ? '' : r.margin.toFixed(1), r.sold, { up: 'ควรขึ้น', down: 'ควรลด', hold: 'คงราคา' }[r.action], r.suggest, r.reason].map(q).join(',');
  }));
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = 'product-costs.csv'; a.click();
}
