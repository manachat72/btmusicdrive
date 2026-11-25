/* ───────── สรุปการเงิน — ต่อท้าย studio-client.js (ใช้ adsFmt / adsCard จาก studio-ads-client.js) ───────── */
var finPeriod = '30';

function renderFinance(fresh) {
  var opts = [['7', '7 วัน'], ['30', '30 วัน'], ['month', 'เดือนนี้'], ['lastmonth', 'เดือนก่อน'], ['90', '90 วัน'], ['year', 'ปีนี้'], ['365', '1 ปี']];
  var bar = '<div class="card" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' + opts.map(function (o) {
    return '<button type="button" class="' + (finPeriod === o[0] ? 'primary' : 'ghost') + ' compact" onclick="finPeriod=\'' + o[0] + '\';renderFinance()">' + o[1] + '</button>';
  }).join('') + '<button type="button" class="ghost compact" style="margin-left:auto" onclick="renderFinance(1)">↻ ดึงใหม่</button></div>';
  html('<div class="page-heading"><div><h1>สรุปการเงิน</h1><p>กำลังดึงออเดอร์เว็บ + TikTok… (ครั้งแรกอาจใช้ 10-30 วินาที)</p></div></div>' + bar);
  fetch('/api/finance?period=' + finPeriod + (fresh ? '&fresh=1' : '')).then(function (r) { return r.json(); }).then(function (d) {
    if (d.error) { html('<div class="page-heading"><div><h1>สรุปการเงิน</h1><p>✗ ' + esc(d.error) + '</p></div></div>' + bar); return; }
    var t = d.totals, w = t.web, f = adsFmt, b = function (n) { return '฿' + f(n); };
    var netColor = t.net >= 0 ? '#047857' : '#b91c1c';

    var max = Math.max.apply(null, d.daily.map(function (x) { return Math.max(x.income, x.adSpend); }).concat([1]));
    var bars = d.daily.map(function (x) {
      return '<div title="' + esc(x.date) + ' · เงินเข้า ' + b(x.income) + ' (เว็บ ' + b(x.webRevenue) + ' · TikTok ' + b(x.ttRevenue) + ') · ค่าโฆษณา ' + b(x.adSpend) + '" style="flex:1;min-width:2px;display:flex;align-items:flex-end;gap:1px;height:100%">' +
        '<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%"><div style="background:#10b981;height:' + (x.ttRevenue / max * 100) + '%"></div><div style="background:#8B7355;height:' + (x.webRevenue / max * 100) + '%"></div></div>' +
        '<div style="flex:1;background:#f59e0b;height:' + (x.adSpend / max * 100) + '%"></div></div>';
    }).join('');

    var td = function (v, c) { return '<td style="text-align:right;padding:6px 8px' + (c ? ';color:' + c : '') + '">' + v + '</td>'; };
    var rows = d.daily.slice().reverse().filter(function (x) { return x.income || x.adSpend; }).map(function (x) {
      return '<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:6px 8px">' + esc(x.date) + '</td>' +
        td(x.webOrders ? f(x.webOrders) + ' · ' + b(x.webRevenue) : '–') + td(x.ttOrders ? f(x.ttOrders) + ' · ' + b(x.ttRevenue) : '–') +
        td(b(x.income)) + td(x.adSpend ? b(x.adSpend) : '–', '#b45309') + td(b(x.net), x.net >= 0 ? '#047857' : '#b91c1c') + '</tr>';
    }).join('');

    var errs = Object.keys(d.errors || {}).map(function (k) {
      return '<div class="hint" style="color:#b91c1c">⚠ ' + ({ web: 'ออเดอร์เว็บ', tiktok: 'TikTok', gmvMax: 'TikTok GMV Max' }[k] || k) + ': ' + esc(d.errors[k]) + '</div>';
    }).join('');

    html('<div class="page-heading"><div><h1>สรุปการเงิน</h1><p>เงินเข้า (เว็บ + TikTok Shop) เทียบค่าโฆษณา TikTok</p></div>' +
      '<div class="page-heading-actions"><span class="page-meta">' + esc(d.range.label) + ' · ' + esc(d.range.start) + ' → ' + esc(d.range.end) + '</span></div></div>' + bar + errs +
      '<div class="card" style="display:flex;gap:12px;flex-wrap:wrap">' +
        adsCard('เงินเข้ารวม', b(t.income), f(t.orders) + ' ออเดอร์') +
        adsCard('ค่าโฆษณา', b(t.adSpend), t.income ? f(t.adShare, 1) + '% ของเงินเข้า' : '') +
        adsCard('เหลือหลังหักโฆษณา', '<span style="color:' + netColor + '">' + b(t.net) + '</span>', 'ยังไม่หักต้นทุนสินค้า/ค่าส่ง/ค่าธรรมเนียม') +
        adsCard('ROAS รวม', t.adSpend ? f(t.roas, 2) + 'x' : '–', 'เงินเข้ารวม ÷ ค่าโฆษณา') +
      '</div>' +
      '<div class="card" style="display:flex;gap:12px;flex-wrap:wrap">' +
        adsCard('ขายบนเว็บ', b(w.revenue), f(w.orders) + ' ออเดอร์') +
        adsCard('· โอน/บัตร (Stripe)', b(w.card), f(w.cardOrders) + ' ออเดอร์') +
        adsCard('· เก็บเงินปลายทาง', b(w.cod), f(w.codOrders) + ' ออเดอร์') +
        adsCard('TikTok Shop', b(t.tiktok.revenue), f(t.tiktok.orders) + ' ออเดอร์ · ROAS ' + (t.adSpend ? f(t.ttRoas, 2) + 'x' : '–')) +
      '</div>' +
      '<div class="card"><h2 style="font-size:15px;margin-bottom:10px">รายวัน <span style="font-weight:400;font-size:12px;color:#6b7280">' +
        '<span style="color:#8B7355">■</span> เว็บ <span style="color:#10b981">■</span> TikTok Shop <span style="color:#f59e0b">■</span> ค่าโฆษณา</span></h2>' +
        '<div style="display:flex;align-items:stretch;height:180px;gap:1px">' + bars + '</div></div>' +
      '<div class="card"><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="border-bottom:1px solid #e5e7eb">' +
        '<th style="text-align:left;padding:6px 8px">วันที่</th><th style="text-align:right;padding:6px 8px">เว็บ (ออเดอร์ · บาท)</th><th style="text-align:right;padding:6px 8px">TikTok Shop</th>' +
        '<th style="text-align:right;padding:6px 8px">เงินเข้า</th><th style="text-align:right;padding:6px 8px">ค่าโฆษณา</th><th style="text-align:right;padding:6px 8px">เหลือ</th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="6" style="padding:12px;text-align:center;color:#6b7280">ไม่มีรายการในช่วงนี้</td></tr>') + '</tbody></table></div></div>' +
      '<div class="hint">เว็บ = ออเดอร์สถานะ ชำระแล้ว/กำลังเตรียม/ส่งแล้ว/ได้รับแล้ว (ไม่นับยกเลิก/ยังไม่จ่าย) · COD นับตั้งแต่สั่ง ยังไม่ใช่เงินเข้าบัญชีจริงจนส่งถึง · ' +
        'TikTok Shop = ยอดที่ TikTok นับว่ามาจากโฆษณา (รวม GMV Max) ไม่ใช่ยอดขายทั้งร้าน · ดึงเมื่อ ' + esc(new Date(d.generatedAt).toLocaleString('th-TH')) + '</div>');
  }).catch(function (e) { html('<div class="page-heading"><div><h1>สรุปการเงิน</h1><p>✗ ' + esc(e.message) + '</p></div></div>' + bar); });
}
