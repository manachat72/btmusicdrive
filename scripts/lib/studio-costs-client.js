/* ───────── ต้นทุนสินค้า — ต่อท้าย studio-client.js (ใช้ adsFmt/esc/html) ───────── */
var costData = null, costSort = 'sku', costDir = 1, costFilter = 'all', costFloor = 60, costDays = 90, costQ = '';

function renderCosts(fresh) {
  html('<div class="page-heading"><div><h1>ต้นทุนสินค้า</h1><p>กำลังโหลด…</p></div></div>');
  fetch('/api/product-costs?days=' + costDays + '&floor=' + costFloor).then(function (r) { return r.json(); }).then(function (d) {
    if (d.error) { html('<div class="page-heading"><div><h1>ต้นทุนสินค้า</h1><p>✗ ' + esc(d.error) + '</p></div></div>'); return; }
    costData = d; drawCosts();
  }).catch(function (e) { html('<div class="page-heading"><div><h1>ต้นทุนสินค้า</h1><p>✗ ' + esc(e.message) + '</p></div></div>'); });
}

function sortCosts(k) { costDir = costSort === k ? -costDir : 1; costSort = k; drawCosts(); }
function costVal(r, k) { return k === 'action' ? { up: 0, down: 1, hold: 2 }[r.action] : r[k]; }

function drawCosts() {
  var d = costData, f = adsFmt, b = function (n) { return '฿' + f(n); };
  var chip = function (k, t) { return '<button type="button" class="' + (costFilter === k ? 'primary' : 'ghost') + ' compact" onclick="costFilter=\'' + k + '\';drawCosts()">' + t + '</button>'; };
  var rows = d.rows.filter(function (r) {
    return (costFilter === 'all' || r.action === costFilter || r.cap === costFilter) && (!costQ || (r.name + ' ' + r.sku).toLowerCase().indexOf(costQ.toLowerCase()) >= 0);
  }).sort(function (a, c) {
    var x = costVal(a, costSort), y = costVal(c, costSort);
    return (typeof x === 'string' ? x.localeCompare(y) : x - y) * costDir;
  });
  var th = function (k, t, left) { return '<th style="padding:6px 8px;text-align:' + (left ? 'left' : 'right') + ';cursor:pointer;white-space:nowrap" onclick="sortCosts(\'' + k + '\')">' + t + (costSort === k ? (costDir === 1 ? ' ▲' : ' ▼') : '') + '</th>'; };
  var color = { up: '#047857', down: '#b91c1c', hold: '#6b7280' }, label = { up: '▲ ควรขึ้น', down: '▼ ควรลด', hold: 'คงราคา' };
  var caps = Object.keys(d.groups);
  var body = rows.map(function (r) {
    var td = function (v, c) { return '<td style="text-align:right;padding:6px 8px' + (c ? ';color:' + c : '') + '">' + v + '</td>'; };
    return '<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:6px 8px;white-space:nowrap">' + esc(r.sku) + '</td>' +
      '<td style="padding:6px 8px;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(r.name) + '">' + esc(r.name) + '</td>' +
      '<td style="padding:6px 8px">' + esc(r.cap) + '</td>' + td(b(r.price)) + (r.accessory ? td('?') + td('?') + td('?') : td(b(r.cost)) + td(b(r.profit), r.profit < 0 ? '#b91c1c' : '') +
      td(r.margin.toFixed(0) + '%', r.margin < d.floor ? '#b91c1c' : '')) + td(r.sold ? f(r.sold) : '–') +
      '<td style="padding:6px 8px;color:' + color[r.action] + ';white-space:nowrap">' + label[r.action] + (r.action !== 'hold' ? ' → ' + b(r.suggest) : '') + '</td>' +
      '<td style="padding:6px 8px;color:#6b7280;font-size:12px">' + esc(r.reason) + '</td></tr>';
  }).join('');
  html('<div class="page-heading"><div><h1>ต้นทุนสินค้า</h1><p>ราคาขาย เทียบราคาทุนตามความจุ พร้อมคำแนะนำขึ้น/ลดราคา · อ่านอย่างเดียว ไม่แก้ราคาให้เอง</p></div>' +
    '<div class="page-heading-actions"><button type="button" class="ghost compact" onclick="downloadCostsCsv()">⬇ ดาวน์โหลด CSV</button></div></div>' +
    '<div class="card" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
    chip('all', 'ทั้งหมด ' + d.rows.length) + chip('up', '▲ ควรขึ้น ' + d.counts.up) + chip('down', '▼ ควรลด ' + d.counts.down) + chip('hold', 'คงราคา ' + d.counts.hold) +
    '<span style="width:12px"></span>' + caps.map(function (c) { return chip(c, c); }).join('') +
    '<input id="costQ" placeholder="ค้นหาชื่อ/SKU" value="' + esc(costQ) + '" oninput="costQ=this.value;drawCosts();var e=$(\'costQ\');e.focus();e.setSelectionRange(1e4,1e4)" style="margin-left:auto;max-width:180px">' +
    '</div>' +
    '<div class="card" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:13px">' +
    '<label>กำไรขั้นต่ำ % <input type="number" min="10" max="95" value="' + costFloor + '" style="width:64px" onchange="costFloor=this.value;renderCosts()"></label>' +
    '<label>ดูยอดขายย้อนหลัง (วัน) <input type="number" min="7" max="730" value="' + costDays + '" style="width:64px" onchange="costDays=this.value;renderCosts()"></label>' +
    '<span style="color:#6b7280">ยังไม่รวมค่าส่งที่ร้านออก ค่ากล่อง/ปก และค่าธรรมเนียมชำระเงิน · "ขายได้" นับเฉพาะออเดอร์จากเว็บ ไม่รวม TikTok Shop/Shopee</span></div>' +
    '<div class="card" style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="border-bottom:2px solid #e5e7eb">' +
    th('sku', 'SKU', 1) + th('name', 'ชื่อสินค้า', 1) + th('cap', 'ความจุ', 1) + th('price', 'ราคาขาย') + th('cost', 'ต้นทุน') + th('profit', 'กำไร/ชิ้น') + th('margin', 'กำไร %') +
    th('sold', 'ขายได้ ' + d.days + ' วัน') + th('action', 'คำแนะนำ', 1) + '<th style="padding:6px 8px;text-align:left">เหตุผล</th></tr></thead><tbody>' + body + '</tbody></table></div>');
}

function downloadCostsCsv() {
  var h = ['SKU', 'ชื่อสินค้า', 'ความจุ', 'ราคาขาย', 'ต้นทุน', 'กำไรต่อชิ้น', 'กำไร %', 'ขายได้', 'คำแนะนำ', 'ราคาแนะนำ', 'เหตุผล'];
  var q = function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; };
  var lines = [h.map(q).join(',')].concat(costData.rows.map(function (r) {
    return [r.sku, r.name, r.cap, r.price, r.cost, r.profit, r.margin.toFixed(1), r.sold, { up: 'ควรขึ้น', down: 'ควรลด', hold: 'คงราคา' }[r.action], r.suggest, r.reason].map(q).join(',');
  }));
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = 'product-costs.csv'; a.click();
}
