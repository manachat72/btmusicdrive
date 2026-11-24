/* ───────── TikTok Ads (2 หน้า: สรุป / โฆษณา) — ต่อท้าย studio-client.js ───────── */
var ADS = null, adsLevel = 'ad', adsSort = 'spend';

function adsFmt(n, d) { return Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: d == null ? 0 : d }); }
function adsLoad(then) {
  html('<div class="page-heading"><div><h1>TikTok Ads</h1><p>กำลังโหลด…</p></div></div>');
  fetch('/api/ads').then(function (r) { return r.json(); }).then(function (d) {
    if (d.error) { html('<div class="page-heading"><div><h1>TikTok Ads</h1><p>' + esc(d.error) + '</p></div></div>' + adsBar()); return; }
    ADS = d; then();
  });
}
function adsBar() {
  return '<div class="card" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
    '<span>ช่วงที่จะดึง</span><select id="adsDays"><option value="30">30 วัน</option><option value="90">90 วัน</option><option value="365">1 ปี</option></select>' +
    '<button type="button" class="ghost compact" onclick="adsRefresh(this)">↻ อัปเดตข้อมูล</button>' +
    '<span class="hint" id="adsMsg"></span></div>';
}
function adsRefresh(btn) {
  btn.disabled = true; $('adsMsg').textContent = 'กำลังดึงจาก TikTok… (อาจใช้ 1-2 นาที)';
  fetch('/api/ads-refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ days: $('adsDays').value }) })
    .then(function (r) { return r.json(); }).then(function (d) {
      if (d.error) { btn.disabled = false; $('adsMsg').textContent = '✗ ' + d.error; return; }
      ADS = null; go(view);
    });
}
function adsHead(title, sub) {
  var r = ADS.range;
  return '<div class="page-heading"><div><h1>' + title + '</h1><p>' + sub + '</p></div>' +
    '<div class="page-heading-actions"><span class="page-meta">' + esc(r.from) + ' → ' + esc(r.to) + '</span></div></div>';
}
function adsCard(label, val, sub) {
  return '<div style="flex:1;min-width:150px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:10px;background:#fff">' +
    '<div style="font-size:12px;color:#6b7280">' + label + '</div><div style="font-size:22px;font-weight:700;margin-top:4px">' + val + '</div>' +
    (sub ? '<div style="font-size:12px;color:#6b7280;margin-top:2px">' + sub + '</div>' : '') + '</div>';
}

/* หน้า 1: สรุป */
function renderAdsSummary() {
  adsLoad(function () {
    var ads = ADS.totals.campaigns, sum = function (k) { return ads.reduce(function (a, x) { return a + (x[k] || 0); }, 0); };
    var spend = sum('spend'), gmv = sum('total_onsite_shopping_value'), ord = sum('onsite_shopping');
    var web = ADS.daily.reduce(function (a, d) { a.o += d.orders || 0; a.r += d.revenue || 0; return a; }, { o: 0, r: 0 });
    var daily = ADS.daily, max = Math.max.apply(null, daily.map(function (d) { return Math.max(d.spend || 0, d.gmv || 0); }).concat([1]));
    var bars = daily.map(function (d) {
      return '<div title="' + esc(d.date) + ' · ค่าโฆษณา ' + adsFmt(d.spend) + ' · GMV ' + adsFmt(d.gmv) + '" style="flex:1;min-width:2px;display:flex;align-items:flex-end;gap:1px;height:100%">' +
        '<div style="flex:1;background:#f59e0b;height:' + (d.spend / max * 100) + '%"></div><div style="flex:1;background:#10b981;height:' + ((d.gmv || 0) / max * 100) + '%"></div></div>';
    }).join('');
    html(adsHead('TikTok สรุป', 'ผลโฆษณาบัญชี buythrrmshop เทียบกับยอดขาย') +
      '<div class="card" style="display:flex;gap:12px;flex-wrap:wrap">' +
      adsCard('ค่าโฆษณา', '฿' + adsFmt(spend)) +
      adsCard('GMV Shop', '฿' + adsFmt(gmv), adsFmt(ord) + ' ออเดอร์') +
      adsCard('ROAS (Shop)', spend ? adsFmt(gmv / spend, 2) + 'x' : '–') +
      adsCard('ออเดอร์เว็บ', adsFmt(web.o), '฿' + adsFmt(web.r)) +
      adsCard('ROAS blended', spend ? adsFmt((gmv + web.r) / spend, 2) + 'x' : '–', 'เว็บแยกโฆษณาไม่ได้') +
      '</div>' +
      '<div class="card"><h2 style="font-size:15px;margin-bottom:10px">รายวัน <span style="font-weight:400;font-size:12px;color:#6b7280"><span style="color:#f59e0b">■</span> ค่าโฆษณา <span style="color:#10b981">■</span> GMV Shop</span></h2>' +
      '<div style="display:flex;align-items:stretch;height:180px;gap:1px">' + bars + '</div></div>' +
      (ADS.ordersError ? '<div class="hint">ออเดอร์เว็บ: ' + esc(ADS.ordersError) + '</div>' : '') +
      adsBar() + '<div class="hint">ข้อมูลเมื่อ ' + esc(new Date(ADS.generatedAt).toLocaleString('th-TH')) + ' · ' + esc(ADS.file) + '</div>');
  });
}

/* หน้า 2: โฆษณา (แคมเปญ / ชุดโฆษณา / โฆษณา) */
function renderAdsList() {
  var draw = function () {
    var rows = (ADS.totals[{ campaign: 'campaigns', adgroup: 'adgroups', ad: 'ads' }[adsLevel]] || []).slice()
      .sort(function (a, b) { return (b[adsSort] || 0) - (a[adsSort] || 0); });
    var th = function (k, t) { return '<th style="text-align:right;cursor:pointer;padding:6px 8px' + (adsSort === k ? ';color:#b45309' : '') + '" onclick="adsSort=\'' + k + '\';renderAdsList()">' + t + '</th>'; };
    var body = rows.map(function (x) {
      var i = x.info || {}, roas = x.shop_roas || 0;
      var name = adsLevel === 'campaign' ? x.campaign_name : adsLevel === 'adgroup' ? x.adgroup_name : (i.creator ? esc(i.creator) + ' · ' : '') + esc((i.adText || x.ad_name || '').slice(0, 60));
      var flag = x.spend > 100 && !x.onsite_shopping ? ' style="background:#fef2f2"' : (roas >= 5 ? ' style="background:#f0fdf4"' : '');
      var td = function (v) { return '<td style="text-align:right;padding:6px 8px">' + v + '</td>'; };
      return '<tr' + flag + '><td style="padding:6px 8px">' + name + (i.status ? ' <span class="hint">' + esc(i.status) + '</span>' : '') + '</td>' +
        td(adsFmt(x.spend)) + td(adsFmt(x.clicks)) + td(adsFmt(x.ctr, 2) + '%') + td(adsFmt(x.onsite_shopping)) + td(adsFmt(x.total_onsite_shopping_value)) + td(roas ? adsFmt(roas, 2) + 'x' : '–') + '</tr>';
    }).join('');
    var tab = function (k, t) { return '<button type="button" class="' + (adsLevel === k ? 'primary' : 'ghost') + ' compact" onclick="adsLevel=\'' + k + '\';renderAdsList()">' + t + '</button>'; };
    html(adsHead('TikTok โฆษณา', 'แดง = ใช้เงินเกิน ฿100 แต่ไม่มียอดขาย · เขียว = ROAS ≥ 5x · คลิกหัวคอลัมน์เพื่อเรียง') +
      '<div class="card"><div style="display:flex;gap:6px;margin-bottom:10px">' + tab('campaign', 'แคมเปญ') + tab('adgroup', 'ชุดโฆษณา') + tab('ad', 'โฆษณา') + '</div>' +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="border-bottom:1px solid #e5e7eb"><th style="text-align:left;padding:6px 8px">ชื่อ</th>' +
      th('spend', 'ค่าโฆษณา') + th('clicks', 'คลิก') + th('ctr', 'CTR') + th('onsite_shopping', 'ออเดอร์') + th('total_onsite_shopping_value', 'GMV') + th('shop_roas', 'ROAS') +
      '</tr></thead><tbody>' + body + '</tbody></table></div></div>');
  };
  if (ADS) draw(); else adsLoad(draw);
}
