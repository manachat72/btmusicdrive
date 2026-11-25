/* ───────── ภาพรวม — หน้าแรกของ Studio (ต่อท้าย studio-client.js · ใช้ adsFmt/esc/html/go) ─────────
 * รวมตัวเลขหลักจาก 3 แหล่งในหน้าเดียว — แต่ละกล่องโหลดของตัวเอง อันไหนเร็วขึ้นก่อน:
 *  /api/product-costs (เร็ว) · /api/finance-files (เร็ว, ไฟล์ export TikTok) · /api/finance (ช้า 10-30 วิ, เว็บ + TikTok API)
 * อ่านอย่างเดียว · กดกล่องเพื่อไปแท็บรายละเอียด */
var ovPeriod = '30', ovSeq = 0;
var OV = { up: '#047857', down: '#b91c1c', warn: '#b45309', muted: '#6b7280', line: '#e5e7eb', web: '#8B7355', tt: '#10b981', ad: '#f59e0b' };

function ovB(v) { return (v < 0 ? '-฿' : '฿') + adsFmt(Math.abs(v)); }
function ovBox(id, title, link, body) {
  return '<div class="card" style="margin:0" id="' + id + '"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">' +
    '<b style="font-weight:600">' + title + '</b>' + (link ? '<a href="#" onclick="go(\'' + link[0] + '\');return false" style="font-size:12px">' + link[1] + ' →</a>' : '') + '</div>' +
    '<div class="ov-body">' + (body || '<span class="hint">กำลังโหลด…</span>') + '</div></div>';
}
function ovFill(id, s, seq) { if (seq !== ovSeq || view !== 'overview') return; var el = $(id); if (el) el.querySelector('.ov-body').innerHTML = s; }
function ovStat(label, value, sub, color) {
  return '<div style="background:#f6f7f8;border-radius:10px;padding:12px 14px;min-width:0"><div style="font-size:12px;color:' + OV.muted + '">' + label + '</div>' +
    '<div style="font-size:24px;font-weight:600;color:' + (color || '#242424') + ';white-space:nowrap">' + value + '</div>' + (sub ? '<div style="font-size:11px;color:' + OV.muted + '">' + sub + '</div>' : '') + '</div>';
}
function ovRow(left, right, color) {
  return '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid ' + OV.line + ';font-size:12px"><span style="min-width:0">' + left + '</span><span style="white-space:nowrap' + (color ? ';color:' + color : '') + '">' + right + '</span></div>';
}

function renderOverview() {
  var seq = ++ovSeq;
  var chip = function (k, t) { return '<button type="button" class="' + (ovPeriod === k ? 'primary' : 'ghost') + ' compact" onclick="ovPeriod=\'' + k + '\';renderOverview()">' + t + '</button>'; };
  html('<div class="page-heading"><div><h1>ภาพรวม</h1><p>เงินเข้า ค่าโฆษณา ต้นทุน และกำไรในหน้าเดียว · กดหัวกล่องเพื่อดูรายละเอียด</p></div>' +
    '<div class="page-heading-actions">' + chip('7', '7 วัน') + chip('30', '30 วัน') + chip('month', 'เดือนนี้') + chip('lastmonth', 'เดือนก่อน') + chip('90', '90 วัน') +
    '<button type="button" class="ghost compact" onclick="renderOverview(1)">↻</button></div></div>' +
    '<div id="ovTop" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px">' +
    ['เงินเข้า', 'ค่าโฆษณา', 'ต้นทุนสินค้า', 'กำไรโดยประมาณ', 'ROAS รวม'].map(function (l) { return ovStat(l, '…', 'กำลังดึงข้อมูลเว็บ + TikTok'); }).join('') + '</div>' +
    '<div style="display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:14px;margin-bottom:14px;align-items:start">' +
    ovBox('ovDaily', 'รายวัน: เงินเข้า เทียบ ค่าโฆษณา', ['finance', 'สรุปการเงิน']) +
    ovBox('ovFiles', 'เงินเข้าบัญชีจริง (ไฟล์ TikTok Shop)', ['finance', 'สรุปการเงิน']) + '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;align-items:start">' +
    ovBox('ovPrice', 'ราคาสินค้า: ควรขึ้น / ควรลด', ['costs', 'ต้นทุนสินค้า']) +
    ovBox('ovCamp', 'แคมเปญ TikTok ที่ควรดู', ['adsLive', 'คุมแคมเปญ']) + '</div>' +
    '<p class="hint" style="margin-top:10px">ต้นทุน/กำไรยังไม่หักค่าส่งที่ร้านออก ค่ากล่อง/ปก และค่าธรรมเนียมชำระเงิน · ต้นทุนออเดอร์ TikTok เป็นค่าประมาณ (ไฟล์/API ไม่บอกความจุ)</p>');

  // ── ราคาสินค้า (เร็ว) ──
  var marginAvg = 0.75;
  fetch('/api/product-costs').then(function (r) { return r.json(); }).then(function (d) {
    if (d.error) return ovFill('ovPrice', '✗ ' + esc(d.error), seq);
    var usb = d.rows.filter(function (r) { return !r.accessory; });
    marginAvg = usb.reduce(function (s, r) { return s + r.margin; }, 0) / (usb.length || 1) / 100;
    var acts = d.rows.filter(function (r) { return r.action !== 'hold'; });
    ovFill('ovPrice', '<div style="display:flex;gap:16px;font-size:13px;margin-bottom:4px"><span>กำไรเฉลี่ย <b>' + (marginAvg * 100).toFixed(0) + '%</b></span>' +
      '<span style="color:' + OV.up + '">▲ ขึ้น ' + d.counts.up + '</span><span style="color:' + OV.down + '">▼ ลด ' + d.counts.down + '</span><span style="color:' + OV.muted + '">คงราคา ' + d.counts.hold + '</span></div>' +
      (acts.length ? acts.slice(0, 6).map(function (r) {
        return ovRow(esc(costShort(r.name)) + ' <span style="color:' + OV.muted + '">' + esc(r.cap) + '</span><br><span style="color:' + OV.muted + '">' + esc(r.reason) + '</span>',
          ovB(r.price) + ' → <b>' + ovB(r.suggest) + '</b>', r.action === 'up' ? OV.up : OV.down);
      }).join('') : ovRow('ทุกสินค้าราคาอยู่ในเกณฑ์', '')), seq);
  }).catch(function (e) { ovFill('ovPrice', '✗ ' + esc(e.message), seq); });

  // ── ไฟล์ export TikTok (เร็ว): เงินเข้าจริง + แคมเปญ ──
  fetch('/api/finance-files').then(function (r) { return r.json(); }).then(function (d) {
    if (d.error) { ovFill('ovFiles', '✗ ' + esc(d.error), seq); ovFill('ovCamp', '✗ ' + esc(d.error), seq); return; }
    if (d.empty) { ovFill('ovFiles', '<span class="hint">ยังไม่มีไฟล์ export — วางที่ tiktok-daily-sales-export/</span>', seq); ovFill('ovCamp', '<span class="hint">ยังไม่มีไฟล์โฆษณา — วางที่ tiktok-daily-ads-spend/</span>', seq); return; }
    var m = d.money, r = d.range;
    ovFill('ovFiles', m ? ('<div class="hint" style="margin-bottom:4px">' + esc(r.reportFrom) + ' → ' + esc(r.reportTo) + '</div>' +
      ovRow('ยอดขายสินค้า (ก่อนส่วนลด)', ovB(m.gross)) + ovRow('ค่าธรรมเนียม TikTok', ovB(m.fees), OV.down) +
      ovRow('<b>เงินเข้าบัญชีจริง</b>', '<b>' + ovB(m.payout) + '</b>', OV.up) +
      (m.sameRange ? ovRow('ค่าโฆษณาที่จ่ายเพิ่มเอง', ovB(-m.adOutOfPocket), OV.down) + ovRow('ต้นทุนสินค้า (ประมาณ ' + adsFmt(m.soldOrders) + ' ออเดอร์)', ovB(-m.productCostEst), OV.down) +
        ovRow('<b>กำไรโดยประมาณ</b>', '<b>' + ovB(m.profitEst) + '</b>', m.profitEst >= 0 ? OV.up : OV.down) : '')) : '<span class="hint">ยังไม่มีไฟล์รายได้</span>', seq);

    // จุดคุ้มทุนของ ROAS ≈ 1 ÷ กำไร % (ก่อนหักค่าธรรมเนียม) — ต่ำกว่านี้ขายแล้วไม่พอจ่ายค่าโฆษณา
    var be = 1 / (marginAvg || 0.75);
    var camps = d.campaigns.filter(function (c) { return c.cost > 0; }).map(function (c) { c.roas = c.revenue / c.cost; return c; })
      .sort(function (a, b) { return a.roas - b.roas; });
    ovFill('ovCamp', '<div class="hint" style="margin-bottom:4px">จากไฟล์โฆษณา ' + esc(r.from) + ' → ' + esc(r.to) + ' · ROAS ต่ำสุดขึ้นก่อน · จุดคุ้มทุน ≈ ' + be.toFixed(1) + 'x (ยังไม่รวมค่าธรรมเนียม)</div>' +
      (camps.length ? camps.slice(0, 6).map(function (c) {
        var col = c.roas < be ? OV.down : c.roas < 3 ? OV.warn : OV.up;
        return ovRow(esc(c.name) + '<br><span style="color:' + OV.muted + '">ใช้ ' + ovB(c.cost) + ' · ขาย ' + ovB(c.revenue) + ' · ' + adsFmt(c.orders) + ' ออเดอร์</span>',
          adsFmt(c.roas, 2) + 'x' + (c.roas < be ? ' ขาดทุน' : c.roas < 3 ? ' ต่ำ' : ''), col);
      }).join('') : ovRow('ไม่มีแคมเปญที่ใช้เงินในช่วงนี้', '')), seq);
  }).catch(function (e) { ovFill('ovFiles', '✗ ' + esc(e.message), seq); });

  // ── เว็บ + TikTok API (ช้า) ──
  fetch('/api/finance?period=' + ovPeriod + (arguments[0] ? '&fresh=1' : '')).then(function (r) { return r.json(); }).then(function (d) {
    if (seq !== ovSeq || view !== 'overview') return;
    if (d.error) { $('ovTop').innerHTML = ovStat('ผิดพลาด', '✗', esc(d.error), OV.down); return; }
    var t = d.totals, w = t.web, err = Object.keys(d.errors || {}).length ? ' · ⚠ ' + esc(Object.values(d.errors).join(' · ')) : '';
    $('ovTop').innerHTML =
      ovStat('เงินเข้า', ovB(t.income), 'เว็บ ' + ovB(w.revenue) + ' · TikTok ' + ovB(t.tiktok.revenue)) +
      ovStat('ค่าโฆษณา', ovB(t.adSpend), (t.adShare || 0).toFixed(0) + '% ของเงินเข้า', OV.warn) +
      ovStat('ต้นทุนสินค้า', ovB(t.cost), 'TikTok ประมาณ ' + ovB(t.ttCostEstimated)) +
      ovStat('กำไรโดยประมาณ', ovB(t.profit), esc(d.range.label) + err, t.profit >= 0 ? OV.up : OV.down) +
      ovStat('ROAS รวม', t.roas ? adsFmt(t.roas, 2) + 'x' : '–', adsFmt(t.orders) + ' ออเดอร์ (เว็บ ' + adsFmt(w.orders) + ')');
    var max = Math.max.apply(null, d.daily.map(function (x) { return Math.max(x.income, x.adSpend); }).concat([1]));
    var bars = d.daily.map(function (x) {
      return '<div title="' + esc(x.date) + ' · เงินเข้า ' + ovB(x.income) + ' (เว็บ ' + ovB(x.webRevenue) + ' · TikTok ' + ovB(x.ttRevenue) + ') · ค่าโฆษณา ' + ovB(x.adSpend) + ' · กำไร ' + ovB(x.profit) + '" style="flex:1;min-width:2px;display:flex;align-items:flex-end;gap:1px;height:100%">' +
        '<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%"><div style="background:' + OV.tt + ';height:' + (x.ttRevenue / max * 100) + '%"></div><div style="background:' + OV.web + ';height:' + (x.webRevenue / max * 100) + '%"></div></div>' +
        '<div style="flex:1;background:' + OV.ad + ';height:' + (x.adSpend / max * 100) + '%"></div></div>';
    }).join('');
    ovFill('ovDaily', '<div style="font-size:11px;color:' + OV.muted + ';margin-bottom:6px"><span style="color:' + OV.web + '">■</span> เว็บ <span style="color:' + OV.tt + '">■</span> TikTok <span style="color:' + OV.ad + '">■</span> ค่าโฆษณา · ชี้แท่งเพื่อดูตัวเลข</div>' +
      '<div style="display:flex;align-items:stretch;height:170px;gap:1px">' + bars + '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:' + OV.muted + ';margin-top:4px"><span>' + esc(d.range.start) + '</span><span>' + esc(d.range.end) + '</span></div>', seq);
  }).catch(function (e) { ovFill('ovDaily', '✗ ' + esc(e.message), seq); });
}
