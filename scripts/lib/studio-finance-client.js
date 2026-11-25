/* ───────── สรุปการเงิน — ต่อท้าย studio-client.js (ใช้ adsFmt / adsCard จาก studio-ads-client.js) ───────── */
var finPeriod = '30', finMode = 'files';
function finModeBar() {
  var b = function (k, t) { return '<button type="button" class="' + (finMode === k ? 'primary' : 'ghost') + ' compact" onclick="finMode=\'' + k + '\';renderFinance()">' + t + '</button>'; };
  return '<div style="display:flex;gap:6px;margin-bottom:12px">' + b('files', '📄 จากไฟล์ export TikTok') + b('live', '⚡ ข้อมูลสด (เว็บ + TikTok API)') + '</div>';
}

function renderFinance(fresh) {
  if (finMode === 'files') return renderFinanceFiles();
  var opts = [['7', '7 วัน'], ['30', '30 วัน'], ['month', 'เดือนนี้'], ['lastmonth', 'เดือนก่อน'], ['90', '90 วัน'], ['year', 'ปีนี้'], ['365', '1 ปี']];
  var bar = finModeBar() + '<div class="card" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' + opts.map(function (o) {
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
        adsCard('เหลือหลังหักโฆษณา', '<span style="color:' + netColor + '">' + b(t.net) + '</span>', 'ก่อนหักต้นทุนสินค้า') +
        adsCard('ต้นทุนสินค้า', b(t.cost), 'เว็บคิดจากสินค้าจริง ' + b(w.cost) + (t.ttCostEstimated ? ' · TikTok ประมาณ ' + b(t.ttCostEstimated) : '')) +
        adsCard('กำไรโดยประมาณ', '<span style="color:' + (t.profit >= 0 ? '#047857' : '#b91c1c') + '">' + b(t.profit) + '</span>', 'ยังไม่หักค่าส่ง/ค่าธรรมเนียม/กล่อง-ปก') +
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

/* ── โหมด "จากไฟล์ export TikTok" (/api/finance-files) ── */
var finFrom = '', finTo = '';
function renderFinanceFiles() {
  html('<div class="page-heading"><div><h1>สรุปการเงิน</h1><p>กำลังอ่านไฟล์…</p></div></div>' + finModeBar());
  var qs = finFrom && finTo ? '?from=' + finFrom + '&to=' + finTo : '';
  fetch('/api/finance-files' + qs).then(function (r) { return r.json(); }).then(function (d) {
    var head = '<div class="page-heading"><div><h1>สรุปการเงิน</h1><p>จากไฟล์ export ของ TikTok Shop (รายได้) + Ads Manager (ค่าโฆษณา GMV Max)</p></div></div>' + finModeBar();
    if (d.error) { html(head + '<div class="card">✗ ' + esc(d.error) + '</div>'); return; }
    if (d.empty) { html(head + '<div class="card">ยังไม่มีไฟล์ — วางไฟล์ไว้ที่<br><code>' + d.dirs.map(esc).join('</code><br><code>') + '</code></div>'); return; }
    var f = adsFmt, b = function (v) { return (v < 0 ? '-฿' : '฿') + f(Math.abs(v)); }, m = d.money, a = d.ads, r = d.range;
    var col = function (v) { return '<span style="color:' + (v >= 0 ? '#047857' : '#b91c1c') + '">' + b(v) + '</span>'; };

    var range = '<div class="card" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span>ช่วง</span>' +
      '<input type="date" id="finFrom" value="' + esc(r.from) + '"> → <input type="date" id="finTo" value="' + esc(r.to) + '">' +
      '<button type="button" class="ghost compact" onclick="finFrom=$(\'finFrom\').value;finTo=$(\'finTo\').value;renderFinanceFiles()">ดู</button>' +
      (r.reportFrom ? '<button type="button" class="ghost compact" onclick="finFrom=\'\';finTo=\'\';renderFinanceFiles()">ช่วงเดียวกับไฟล์รายได้</button>' : '') +
      '<span class="hint">ไฟล์รายได้: ' + esc(r.reportFrom || '–') + ' → ' + esc(r.reportTo || '–') + ' · ไฟล์โฆษณา: ' + esc(r.adsFrom || '–') + ' → ' + esc(r.adsTo || '–') + '</span></div>';

    var moneyCards = '';
    if (m) {
      moneyCards = (m.sameRange ? '' : '<div class="hint" style="color:#b45309">⚠ ยอดเงินเข้ามาจากไฟล์รายได้ช่วง ' + esc(r.reportFrom) + ' → ' + esc(r.reportTo) + ' เท่านั้น (ไฟล์เป็นยอดสรุปทั้งช่วง แยกวันไม่ได้) — ค่าโฆษณาด้านล่างเป็นช่วงที่เลือก</div>') +
        '<div class="card" style="display:flex;gap:12px;flex-wrap:wrap">' +
        adsCard('ยอดขายสินค้า (ก่อนส่วนลด)', b(m.gross), 'ส่วนลดร้าน ' + b(m.sellerDiscount) + ' · คืนเงิน ' + b(m.refunds)) +
        adsCard('ค่าธรรมเนียม TikTok', b(m.fees), 'คอมมิชชั่น ค่าส่ง แอฟฟิลิเอต ฯลฯ') +
        adsCard('ค่าโฆษณาที่หักจากยอดขาย', b(-m.paidFromGmv), '"ชำระด้วย GMV สำหรับโฆษณา"') +
        adsCard('เงินเข้าบัญชีจริง', '<span style="color:#047857">' + b(m.payout) + '</span>', 'ยอดการชำระเงินทั้งหมด') +
        (m.sameRange ? adsCard('เหลือหลังจ่ายค่าโฆษณาเพิ่ม', col(m.netAfterAds), 'ค่าโฆษณาส่วนที่จ่ายเอง ' + b(m.adOutOfPocket)) : '') +
        (m.sameRange ? adsCard('ต้นทุนสินค้า (ประมาณ)', b(-m.productCostEst), f(m.soldOrders) + ' ออเดอร์ × ฿55 (ทุน 4GB — ไฟล์ไม่บอกความจุ)') : '') +
        (m.sameRange ? adsCard('กำไรโดยประมาณ', col(m.profitEst), 'ยังไม่หักค่าส่งที่ร้านจ่าย/กล่อง-ปก') : '') +
        '</div>';
    }
    var adCards = '<div class="card" style="display:flex;gap:12px;flex-wrap:wrap">' +
      adsCard('ค่าโฆษณา GMV Max', b(a.cost), esc(r.from) + ' → ' + esc(r.to)) +
      adsCard('ยอดขายจากโฆษณา', b(a.revenue), f(a.orders) + ' ออเดอร์ SKU') +
      adsCard('ROI โฆษณา', a.cost ? f(a.revenue / a.cost, 2) + 'x' : '–', 'ต้นทุน ' + (a.orders ? b(a.cost / a.orders) : '–') + '/ออเดอร์') +
      adsCard('ค่าแอฟฟิลิเอต (ในแคมเปญ)', b(a.affiliate)) + '</div>';

    var max = Math.max.apply(null, d.daily.map(function (x) { return Math.max(x.revenue, x.cost); }).concat([1]));
    var bars = d.daily.map(function (x) {
      return '<div title="' + esc(x.date) + ' · ยอดขายจากโฆษณา ' + b(x.revenue) + ' (' + f(x.orders) + ') · ค่าโฆษณา ' + b(x.cost) + '" style="flex:1;min-width:2px;display:flex;align-items:flex-end;gap:1px;height:100%">' +
        '<div style="flex:1;background:#10b981;height:' + (x.revenue / max * 100) + '%"></div><div style="flex:1;background:#f59e0b;height:' + (x.cost / max * 100) + '%"></div></div>';
    }).join('');
    var chart = '<div class="card"><h2 style="font-size:15px;margin-bottom:10px">รายวัน <span style="font-weight:400;font-size:12px;color:#6b7280"><span style="color:#10b981">■</span> ยอดขายจากโฆษณา <span style="color:#f59e0b">■</span> ค่าโฆษณา</span></h2>' +
      '<div style="display:flex;align-items:stretch;height:180px;gap:1px">' + bars + '</div></div>';

    var th = function (t, l) { return '<th style="text-align:' + (l ? 'left' : 'right') + ';padding:6px 8px">' + t + '</th>'; };
    var td = function (v, c) { return '<td style="text-align:right;padding:6px 8px' + (c ? ';color:' + c : '') + '">' + v + '</td>'; };
    var camps = '<div class="card"><h2 style="font-size:15px;margin-bottom:10px">แคมเปญ</h2><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="border-bottom:1px solid #e5e7eb">' +
      th('แคมเปญ', 1) + th('ค่าโฆษณา') + th('ยอดขาย') + th('ออเดอร์') + th('ROI') + th('แอฟฟิลิเอต') + th('ล่าสุด') + '</tr></thead><tbody>' +
      d.campaigns.map(function (c) {
        var roi = c.cost ? c.revenue / c.cost : 0;
        return '<tr style="border-bottom:1px solid #f3f4f6' + (c.cost > 100 && roi < 3 ? ';background:#fef2f2' : roi >= 8 ? ';background:#f0fdf4' : '') + '"><td style="padding:6px 8px">' + esc(c.name) + '</td>' +
          td(b(c.cost), '#b45309') + td(b(c.revenue)) + td(f(c.orders)) + td(c.cost ? f(roi, 2) + 'x' : '–') + td(b(c.affiliate)) + td(esc(c.last)) + '</tr>';
      }).join('') + '</tbody></table></div><div class="hint">แดง = ใช้เงินเกิน ฿100 แต่ ROI ต่ำกว่า 3x · เขียว = ROI ≥ 8x</div></div>';

    var fees = m ? '<div class="card"><details><summary style="cursor:pointer;font-weight:600">รายการในไฟล์รายได้ทั้งหมด (' + m.feeLines.length + ' บรรทัดที่ไม่เป็น 0)</summary><table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px">' +
      m.feeLines.map(function (l) { return '<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:4px 8px">' + esc(l.k) + '</td>' + td(b(l.v), l.v < 0 ? '#b91c1c' : '') + '</tr>'; }).join('') + '</table></details></div>' : '';

    html(head + range + moneyCards + adCards + chart + camps + fees +
      '<div class="hint">ไฟล์รายได้: ' + (d.files.sales.map(esc).join(', ') || '–') + ' · ไฟล์โฆษณา: ' + (d.files.ads.map(esc).join(', ') || '–') +
      ' · วางไฟล์ใหม่ทับ/เพิ่มในโฟลเดอร์ แล้วกดแท็บนี้อีกครั้ง (ไม่ต้องรีสตาร์ท)</div>');
  }).catch(function (e) { html('<div class="page-heading"><div><h1>สรุปการเงิน</h1><p>✗ ' + esc(e.message) + '</p></div></div>' + finModeBar()); });
}
