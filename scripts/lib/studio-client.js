/* Product Studio — client (เสิร์ฟที่ /studio.js) */
'use strict';

var META = { folders: null, categories: [], nextCode: '', loggedIn: false };
var WEB = [];        // สินค้าบนเว็บ (products.json)
var MKT = [];        // catalog marketplace
var draft = null;    // ร่างสินค้าใหม่หลังเตรียมรูป
var editing = null;  // สินค้าที่กำลังแก้
var upImages = [], trackList = [], editTrack = null, addImgs = [], editImages = [];
var view = 'new';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
function $(id) { return document.getElementById(id); }
function html(s) { $('view').innerHTML = s; }
function status(id, msg, cls) { var e = $(id); if (e) e.innerHTML = cls ? '<span class="' + cls + '">' + msg + '</span>' : msg; }

async function jget(u) { var r = await fetch(u); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function jpost(u, body) {
  var r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
function fileToB64(f) {
  return new Promise(function (ok, no) {
    var r = new FileReader();
    r.onload = function () { ok(r.result.split(',')[1]); };
    r.onerror = no; r.readAsDataURL(f);
  });
}

/* ───────── SEO preview ───────── */
function serpHtml(seo) {
  var slug = seo.slug || '';
  return '<div class="serp">' +
    '<div class="u">btmusicdrive.com › product › ' + esc(slug) + '</div>' +
    '<div class="t">' + esc((seo.metaTitle || seo.name || '').slice(0, 70)) + '</div>' +
    '<div class="d">' + esc(seo.metaDescription || '') + '</div></div>' +
    '<div class="hint">นี่คือหน้าตาบน Google · ชื่อไฟล์รูป: <b>' + esc(seo.imageSlug || slug) + '-1.webp</b></div>';
}
function issuesHtml(issues) {
  if (!issues || !issues.length) return '<div class="issues good">✔ SEO ผ่านครบทุกข้อ</div>';
  var hasErr = issues.some(function (i) { return i.level === 'error'; });
  return '<div class="issues ' + (hasErr ? 'error' : 'warn') + '">' +
    issues.map(function (i) { return (i.level === 'error' ? '✖ ' : '⚠ ') + esc(i.msg); }).join('<br>') + '</div>';
}
function tagsHtml(tags) {
  return (tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
}

/* ───────── nav ───────── */
function go(v) {
  view = v;
  ['new', 'edit', 'qr'].forEach(function (k) { $('tab' + k[0].toUpperCase() + k.slice(1)).classList.toggle('on', k === v); });
  if (v === 'new') renderNew();
  if (v === 'edit') renderEdit();
  if (v === 'qr') renderQr();
}

/* ═════════ 1. ลงสินค้าใหม่ ═════════ */
function renderNew() {
  draft = null; upImages = []; trackList = [];
  var folders = META.folders;
  html(
    '<div class="card"><h2>➕ ลงสินค้าใหม่</h2>' +
    '<div class="sub">ต้นฉบับเก็บ R2 + NAS · รูปกลาง 1200 สำหรับ xlsx · รูปเว็บ webp+avif ชื่อ SEO · ลงเว็บเสร็จได้ xlsx ทุกแพลตฟอร์มทันที (code ถัดไป: ' + esc(META.nextCode) + ')</div>' +
    '<div class="f"><label>ชื่อสินค้าแบบสั้น — พิมพ์แบบที่ลูกค้าค้นหา (เช่น ฮิตยุค90, ลูกทุ่งอมตะ, เพื่อชีวิตคาราบาว)</label>' +
    '<input type="text" id="nName" placeholder="ฮิตยุค90" oninput="debouncedSeo()"></div>' +
    '<div class="row">' +
    '<div class="f"><label>ราคา (บาท)</label><input type="number" id="nPrice" value="279" oninput="debouncedSeo()"></div>' +
    '<div class="f"><label>ความจุ</label><select id="nCap" onchange="previewSeo()">' +
    ['512MB', '1GB', '2GB', '4GB', '8GB', '16GB', '32GB'].map(function (c) { return '<option' + (c === '4GB' ? ' selected' : '') + '>' + c + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="f"><label>หมวดหมู่</label><select id="nCat" onchange="previewSeo()"><option value="">— เดาจากชื่อให้อัตโนมัติ —</option>' +
    META.categories.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
    '<div class="f"><label>สต็อก</label><input type="number" id="nStock" value="100"></div>' +
    '</div>' +
    '<div class="f"><label>📄 รายชื่อเพลง (.txt — 1 เพลงต่อบรรทัด)</label>' +
    '<input type="file" id="nTxt" accept=".txt" onchange="readTxt(this)">' +
    '<div id="txtInfo">ไม่บังคับ แต่แนะนำมาก — ใช้ดึงชื่อศิลปินไปทำคีย์เวิร์ด และโชว์รายชื่อเพลงบนหน้าสินค้า</div></div>' +
    '<div class="f" style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap"><div class="chk" style="margin:0;padding:6px 12px;border:1px solid #d6d3ce;border-radius:10px;background:#fff"><label style="font-weight:400"><input type="radio" name="seomode" value="rule" checked style="margin-right:6px">แบบธรรมดา (rule-based)</label></div>' +
    '<div class="chk" style="margin:0;padding:6px 12px;border:1px solid var(--primary);border-radius:10px;background:#f8f5ef"><label style="font-weight:400"><input type="radio" name="seomode" value="ai" style="margin-right:6px">ใช้เอเจน (claude Max)</label></div>' +
    '<button class="ghost" style="padding:6px 12px;font-size:12px" title="ให้ claude CLI (Max) วิจัยศิลปินที่ยังไม่รู้จัก" onclick="researchArtists(this,event)">✨ AI วิจัยศิลปิน</button></div>' +
    '<div class="hint" style="margin-top:4px">โหมดแบบธรรมดา = rule-based ทันที · โหมดใช้เอเจน = กดปุ่ม ✨ เพื่อสั่ง AI ค้นเว็บหาว่าชื่อนี้คือใครก่อน (ไม่เสียเงิน API ใช้ Max) · กด Shift ค้างตอนคลิก = วิจัยซ้ำทับของเดิม</div>' +
    '<div class="f"><label>รูปสินค้า</label>' +
    '<div class="src"><input type="radio" name="src" id="srcNas" value="nas"' + (folders ? ' checked' : ' disabled') + '>' +
    '<label for="srcNas" style="display:inline">ใช้โฟลเดอร์ที่มีอยู่บน NAS</label>' +
    '<select id="nFolder" style="width:100%;margin-top:8px;border:1px solid #d6d3ce;border-radius:8px;padding:8px">' +
    (folders ? folders.map(function (f) { return '<option value="' + esc(f.name) + '">' + esc(f.name) + ' (' + f.count + ' รูป)</option>'; }).join('') : '<option>เข้าถึง NAS ไม่ได้</option>') +
    '</select></div>' +
    '<div class="src"><input type="radio" name="src" id="srcUp" value="upload"' + (folders ? '' : ' checked') + '>' +
    '<label for="srcUp" style="display:inline">อัปโหลดรูปใหม่' + (folders ? ' (เก็บลง NAS ให้เอง)' : ' — NAS ไม่ได้ต่อ ต้นฉบับจะเก็บบน R2 อย่างเดียว') + '</label>' +
    '<input type="file" id="nFiles" accept="image/*" multiple style="margin-top:8px" onchange="previewFiles(this)">' +
    '<div class="hint">รูปแรก = ภาพปก · สูงสุด 9 รูป · ต้นฉบับขึ้น R2 originals/ ไม่ย่อไม่บีบ ทำรูปใหม่ได้ตลอด</div>' +
    '<div class="thumbs" id="thumbs"></div></div></div>' +
    '<div id="seoBox"></div>' +
    '<div class="actions"><button class="primary" id="goBtn" onclick="createDraft(this)">เตรียมรูป + SEO ✨</button></div>' +
    '<div class="st" id="nStatus"></div></div>'
  );
}

var seoTimer = null;
function debouncedSeo() { clearTimeout(seoTimer); seoTimer = setTimeout(previewSeo, 350); }

async function previewSeo() {
  var name = $('nName') ? $('nName').value.trim() : '';
  if (!name) { $('seoBox').innerHTML = ''; return; }
  try {
    var seo = await jpost('/api/seo', {
      shortName: name, tracklist: trackList,
      capacity: $('nCap').value, price: +$('nPrice').value || 279,
      categoryName: $('nCat').value || undefined
    });
    $('seoBox').innerHTML =
      '<h3 style="font-size:14px;color:#475569;margin:16px 0 6px">พรีวิว SEO (อัปเดตสด)</h3>' +
      serpHtml(seo) + issuesHtml(seo.issues) +
      '<div class="hint">ชื่อเต็ม: <b>' + esc(seo.name) + '</b><br>หมวด: ' + esc(seo.categoryName) +
      (seo.artists && seo.artists.length ? ' · ศิลปินที่จับได้: ' + esc(seo.artists.join(', ')) : '') + '</div>' +
      '<div style="margin-top:8px">' + tagsHtml(seo.tags) + '</div>';
  } catch (e) { $('seoBox').innerHTML = '<div class="issues error">✖ ' + esc(e.message).slice(0, 300) + '</div>'; }
}

/* วิจัยศิลปินที่ในรายชื่อเพลงด้วย claude CLI (Max) — เซฟลง artists.json
 * เรียกเพียงครั้งเดียวต่อศิลปิน (ไม่ตัดซ้ำ cache อยู่แล้ว) */
async function researchArtists(btn, ev) {
  var shortName = ($('nName') && $('nName').value || '').trim();
  if (!trackList.length && !shortName) { $('txtInfo').textContent = 'พิมพ์ชื่อสินค้า หรืออ่าน .txt รายชื่อเพลงก่อน'; return; }
  try {
    btn.disabled = true;
    $('txtInfo').textContent = '⏳ กำลังวิจัยด้วย AI (ค้นเว็บด้วย) … อาจใช้ 1-2 นาที — ' + [shortName].concat(trackList.slice(0, 8)).filter(Boolean).join(', ');
    var out = await jpost('/api/ai-research', { tracklist: trackList, shortName: shortName, force: !!(ev && ev.shiftKey) });
    var done = out.ok.length, skip = out.skipped.length, err = out.errors.length;
    $('txtInfo').innerHTML = '✔ เซ็น ' + done + ' · มีอยู่แล้ว ' + skip + (err ? ' · ⚠ ' + err + ' ข้อผิดพลาด (' + esc(out.errors.join(' · ')).slice(0, 300) + ')' : '');
    previewSeo(); // เจนใหม่ — จะได้คีย์เวิร์ดจาก cache ที่เพิ่งเซฟ
  } catch (e) { $('txtInfo').textContent = '✖ ' + e.message.slice(0, 200); }
  btn.disabled = false;
}

function previewFiles(inp) {
  $('srcUp').checked = true;
  upImages = [].slice.call(inp.files, 0, 9);
  var t = $('thumbs'); t.innerHTML = '';
  upImages.forEach(function (f) {
    var img = document.createElement('img');
    img.src = URL.createObjectURL(f);
    t.appendChild(img);
  });
}

function parseTracks(txt) {
  return txt.split(/\r?\n/).map(function (s) { return s.replace(/^\s*\d+[.)\-]?\s*/, '').trim(); }).filter(Boolean);
}
function readTxt(inp) {
  var f = inp.files[0]; if (!f) return;
  f.text().then(function (txt) {
    trackList = parseTracks(txt);
    $('txtInfo').textContent = '✔ อ่านได้ ' + trackList.length + ' เพลง — ' + trackList.slice(0, 3).join(' / ') + (trackList.length > 3 ? ' …' : '');
    previewSeo();
  });
}

async function createDraft(btn) {
  var name = $('nName').value.trim();
  if (!name) { status('nStatus', 'ใส่ชื่อสินค้าก่อนครับ', 'err'); return; }
  // โหมดใช้เอเจน: ต้องบังคับว่า cache วิจัยจบก่อน ไม่งั้นยังไม่รู้ชื่อศิลปิน
  var mode = document.querySelector('input[name=seomode]:checked') ?
    document.querySelector('input[name=seomode]:checked').value : 'rule';
  if (mode === 'ai' && draft && draft.artistsMissing && draft.artistsMissing.length) {
    status('nStatus', '⚠ โหมดเอเจนแต่ยังไม่วิจัยศิลปิน: ' + draft.artistsMissing.slice(0, 3).join(', ') + ' — กด "✨ AI วิจัยศิลปิน" ก่อน', 'err');
    return;
  }
  if (mode === 'ai') {
    var prev = await jpost('/api/seo', {
      shortName: name, tracklist: trackList,
      capacity: $('nCap').value, price: +$('nPrice').value || 279,
      categoryName: $('nCat').value || undefined
    });
    if (prev.artistsMissing && prev.artistsMissing.length) {
      status('nStatus', '⚠ โหมดเอเจนแต่ยังไม่วิจัย: ' + prev.artistsMissing.slice(0, 3).join(', ') + ' — กด "✨ AI วิจัยศิลปิน" ก่อน', 'err');
      return;
    }
  }
  var useNas = $('srcNas') && $('srcNas').checked;
  var body = {
    name: name, price: +$('nPrice').value || 279, capacity: $('nCap').value,
    categoryName: $('nCat').value || undefined, tracklist: trackList
  };
  if (useNas) body.folder = $('nFolder').value;
  else {
    if (!upImages.length) { status('nStatus', 'เลือกรูปก่อนครับ', 'err'); return; }
    status('nStatus', '⏳ กำลังอ่านรูป…');
    body.images = [];
    for (var i = 0; i < upImages.length; i++) {
      body.images.push({ name: upImages[i].name, data: await fileToB64(upImages[i]) });
    }
  }
  btn.disabled = true;
  status('nStatus', '⏳ ทำรูปเว็บ (webp+avif) → รูป marketplace → R2 → SEO… ใช้เวลาสักครู่');
  try {
    var stock = +$('nStock').value || 100;
    draft = await jpost('/api/new-product', body);
    draft.stock = stock;
    renderReview();
  } catch (e) {
    status('nStatus', '✖ ' + esc(e.message).slice(0, 600), 'err');
    btn.disabled = false;
  }
}

function loginBoxHtml() {
  return '<div class="card" id="loginBox"' + (META.loggedIn ? ' style="display:none"' : '') + '>' +
    '<h2>🔑 เข้าสู่ระบบแอดมิน</h2><div class="sub">ใช้บัญชีแอดมินของ btmusicdrive.com — เก็บไว้ในหน่วยความจำระหว่างเปิด studio เท่านั้น</div>' +
    '<div class="sub">บัญชีที่สมัครผ่าน Google ไม่มีรหัสผ่าน — เว้นอีเมลว่างแล้วกรอกแค่ <b>ADMIN_PASSWORD</b> ก็เข้าได้</div>' +
    '<div class="row"><div class="f"><input type="text" id="lEmail" placeholder="อีเมลแอดมิน (เว้นว่างได้)"></div>' +
    '<div class="f"><input type="password" id="lPass" placeholder="รหัสผ่าน หรือ ADMIN_PASSWORD"></div></div></div>';
}

async function ensureLogin(statusId) {
  var lb = $('loginBox');
  if (!lb || lb.style.display === 'none') return;
  status(statusId, '⏳ กำลังเข้าสู่ระบบ…');
  await jpost('/api/login', { email: $('lEmail').value, password: $('lPass').value });
  setLoggedIn();
  lb.style.display = 'none';
}

function setLoggedIn() {
  META.loggedIn = true;
  var w = $('who');
  w.textContent = 'แอดมิน ✔ · ' + META.apiBase.replace('/api', '');
  w.style.textDecoration = 'none';
  w.style.cursor = 'default';
  w.onclick = null;
}


/* ล็อกอินแบบบังคับตอนเปิดโปรแกรม — เดิมปล่อยให้ทำงานไปจนถึงขั้นเขียน DB ค่อยฟ้อง
   ทำให้เสียเวลาทำรูปทิ้งฟรี ตอนนี้บังหน้าจอไว้จนกว่าจะล็อกอินสำเร็จ */
function showLoginGate() {
  if ($('topLogin')) { $('lEmail2').focus(); return; }
  var g = document.createElement('div');
  g.id = 'loginGate';
  g.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.75);' +
    'display:flex;align-items:center;justify-content:center;padding:20px';
  g.innerHTML =
    '<div class="card" id="topLogin" style="max-width:520px;width:100%;margin:0">' +
    '<h2>🔑 เข้าสู่ระบบแอดมินก่อนเริ่มงาน</h2>' +
    '<div class="sub">ต้องล็อกอินก่อนถึงจะลงสินค้า/แก้ไขสินค้าได้ — เก็บไว้ในหน่วยความจำระหว่างเปิด studio เท่านั้น ไม่เขียนลงไฟล์</div>' +
    '<div class="row"><div class="f"><input type="text" id="lEmail2" placeholder="อีเมลแอดมิน (เว้นว่างได้ถ้าใช้รหัสแอดมิน)"></div>' +
    '<div class="f"><input type="password" id="lPass2" placeholder="รหัสผ่าน" onkeydown="if(event.key===&quot;Enter&quot;)doLogin(document.getElementById(&quot;topLoginBtn&quot;))"></div></div>' +
    '<div class="actions"><button class="primary" id="topLoginBtn" onclick="doLogin(this)">เข้าสู่ระบบ</button></div>' +
    '<div class="st" id="topLoginStatus"></div></div>';
  document.body.appendChild(g);
  $('lEmail2').focus();
}
function closeLoginGate() { var g = $('loginGate'); if (g) g.remove(); }

/* ล็อกอินจากมุมขวาบน — ไม่ต้องรอถึงขั้นตอนลงเว็บ */
function openLogin() {
  if (META.loggedIn) return;
  if ($('loginGate') || $('topLogin')) { $('lEmail2').focus(); return; }
  return showLoginGate();
  var box = document.createElement('div');
  box.className = 'card';
  box.id = 'topLogin';
  box.innerHTML =
    '<h2>🔑 เข้าสู่ระบบแอดมิน</h2>' +
    '<div class="sub">บัญชีแอดมินของ btmusicdrive.com — เก็บไว้ในหน่วยความจำระหว่างเปิด studio เท่านั้น ไม่เขียนลงไฟล์</div>' +
    '<div class="row"><div class="f"><input type="text" id="lEmail2" placeholder="อีเมลแอดมิน"></div>' +
    '<div class="f"><input type="password" id="lPass2" placeholder="รหัสผ่าน" onkeydown="if(event.key===\'Enter\')doLogin(document.getElementById(\'topLoginBtn\'))"></div></div>' +
    '<div class="actions"><button class="ghost" onclick="this.closest(\'.card\').remove()">ปิด</button>' +
    '<button class="primary" id="topLoginBtn" onclick="doLogin(this)">เข้าสู่ระบบ</button></div>' +
    '<div class="st" id="topLoginStatus"></div>';
  $('view').insertBefore(box, $('view').firstChild);
  $('lEmail2').focus();
}

async function doLogin(btn) {
  btn.disabled = true;
  status('topLoginStatus', '⏳ กำลังเข้าสู่ระบบ…');
  try {
    await jpost('/api/login', { email: $('lEmail2').value, password: $('lPass2').value });
    setLoggedIn();
    var lb = $('loginBox'); if (lb) lb.style.display = 'none';
    status('topLoginStatus', '<span class="ok">✔ เข้าสู่ระบบแล้ว</span>');
    setTimeout(function () { closeLoginGate(); var b = $('topLogin'); if (b) b.remove(); }, 900);
  } catch (e) {
    status('topLoginStatus', '✖ ' + esc(e.message).slice(0, 300), 'err');
    btn.disabled = false;
  }
}

function renderReview() {
  html(
    loginBoxHtml() +
    '<div class="card"><h2>📝 รีวิวก่อนลงเว็บ</h2>' +
    '<div class="sub">code ' + esc(draft.code) + ' · เก็บครบ 3 ชั้นแล้ว: ' +
    '<b>ต้นฉบับ</b> ' + (draft.originals || []).length + ' ไฟล์บน R2 · ' +
    '<b>รูปกลาง 1200</b> ' + draft.r2Images.length + ' ใบ (ลิงก์สำหรับ xlsx) · ' +
    '<b>รูปเว็บ</b> ' + draft.images.length + ' ใบ (' + esc(draft.imgSlug) + ')</div>' +
    '<div class="imgs">' + draft.images.map(function (u, i) {
      return '<a href="' + u + '" target="_blank" class="' + (i === 0 ? 'cover' : '') + '"><img src="' + u + '"></a>';
    }).join('') + '</div>' +
    serpHtml(draft) + issuesHtml(draft.issues) +
    '<div class="f"><label>ชื่อสินค้า (SEO)</label><input type="text" id="pName" value="' + esc(draft.name) + '"></div>' +
    '<div class="f"><label>รายละเอียด — 155 ตัวแรกคือ meta description บน Google</label><textarea id="pDesc">' + esc(draft.description) + '</textarea></div>' +
    '<div class="row">' +
    '<div class="f"><label>ราคา</label><input type="number" id="pPrice" value="' + draft.price + '"></div>' +
    '<div class="f"><label>หมวดหมู่</label><select id="pCat">' + META.categories.map(function (c) {
      return '<option' + (c === draft.categoryName ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('') + '</select></div>' +
    '<div class="f"><label>สต็อก</label><input type="number" id="pStock" value="' + (draft.stock || 100) + '"></div>' +
    '</div>' +
    '<div class="f"><label>Tags / คีย์เวิร์ด (คั่นด้วย ,)</label><input type="text" id="pTags" value="' + esc((draft.tags || []).join(', ')) + '"></div>' +
    '<div class="hint">รายชื่อเพลง ' + draft.tracklist.length + ' เพลง · SKU BT-' + esc(draft.code) + ' · slug <b>' + esc(draft.slug) + '</b></div>' +
    '<div class="actions"><button class="ghost" onclick="go(\'new\')">← เริ่มใหม่</button>' +
    '<button class="primary" id="pubBtn" onclick="publish(this)">✅ ยืนยันลงเว็บ + สร้าง xlsx</button></div>' +
    '<div class="st" id="pStatus"></div></div>'
  );
}

async function publish(btn) {
  btn.disabled = true;
  try {
    await ensureLogin('pStatus');
    status('pStatus', '⏳ build + push รูป → ลงสินค้า → sync + sitemap → xlsx… (ขั้นตอนนี้นานสุด)');
    var out = await jpost('/api/publish', {
      code: draft.code, imgSlug: draft.imgSlug, slug: draft.slug,
      name: $('pName').value, description: $('pDesc').value,
      price: +$('pPrice').value, stock: +$('pStock').value, categoryName: $('pCat').value,
      tags: $('pTags').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      capacity: draft.capacity, specs: draft.specs, tracklist: draft.tracklist, images: draft.images
    });
    status('pStatus',
      '<span class="ok">🎉 ลงเว็บสำเร็จ — <a href="' + out.url + '" target="_blank">' + out.url + '</a></span><br>' +
      esc(out.logs.join('\n')) + filesHtml(out.files) + qrHtml(out.qr));
    jget('/api/web-products').then(function (w) { WEB = w; });
  } catch (e) {
    status('pStatus', '✖ ' + esc(e.message).slice(0, 800), 'err');
    btn.disabled = false;
  }
}

/** ลิงก์ QR รายชื่อเพลงที่ studio สร้างให้อัตโนมัติตอนลงสินค้า (ไฟล์อยู่ใน qr/) */
function qrHtml(qr) {
  if (!qr || !qr.file) return '';
  return '<div class="files"><a class="btn" style="background:#8B7355" href="/qr/' + encodeURIComponent(qr.file) +
    '" download="' + esc(qr.file) + '">🔗 QR รายชื่อเพลง<span style="font-weight:400;opacity:.85;font-size:11px"> ' +
    esc(qr.file) + '</span></a></div>';
}

function filesHtml(files) {
  if (!files || !files.length) return '';
  var label = { shopee: '🟠 Shopee', tiktok: '⬛ TikTok Shop', lazada: '🔵 Lazada' };
  return '<div class="files">' + files.map(function (f) {
    if (!f.ok) return '<span class="warnc">⚠ ' + esc(f.platform) + ': ' + esc(f.error || '') + '</span>';
    return '<a class="btn ' + f.platform + '" href="/api/download?file=' + encodeURIComponent(f.file) + '">' +
      (label[f.platform] || f.platform) + ' ⬇<span style="font-weight:400;opacity:.85;font-size:11px"> ' + esc(f.file) + '</span></a>';
  }).join('') + '</div>';
}

/* ═════════ 2. แก้ไขสินค้าเดิม ═════════ */
function renderEdit() {
  editing = null; editTrack = null; addImgs = [];
  html(
    '<div class="split">' +
    '<div><div class="card" style="padding:14px 16px"><input type="text" id="q" placeholder="ค้นหาสินค้าบนเว็บ… (ชื่อ / slug / SKU)" ' +
    'style="width:100%;border:1px solid #d6d3ce;border-radius:8px;padding:9px 12px;font-size:14px" oninput="filterWeb(this.value)">' +
    '<div class="hint">' + WEB.length + ' สินค้าบนเว็บ (จาก products.json)</div></div>' +
    '<div class="list" id="wlist"></div></div>' +
    '<div id="epane"><div class="card"><div class="sub" style="margin:0">← เลือกสินค้าที่จะแก้</div></div></div></div>'
  );
  drawWeb(WEB);
}
function drawWeb(items) {
  $('wlist').innerHTML = items.slice(0, 300).map(function (p) {
    return '<div class="item" data-id="' + esc(p.id) + '" onclick="pickWeb(\'' + esc(p.id) + '\')">' +
      '<img loading="lazy" src="' + esc(p.imageUrl || '') + '" alt="">' +
      '<div><div class="t">' + esc(p.name) + '</div>' +
      '<div class="m">฿' + p.price + ' · สต็อก ' + p.stock + ' · ' + esc(p.category || '-') + '</div></div></div>';
  }).join('') || '<div class="hint" style="padding:14px">ไม่พบสินค้า</div>';
}
function filterWeb(q) {
  q = q.toLowerCase();
  drawWeb(WEB.filter(function (p) {
    return (p.name || '').toLowerCase().indexOf(q) >= 0 ||
      (p.slug || '').toLowerCase().indexOf(q) >= 0 ||
      (p.sku || '').toLowerCase().indexOf(q) >= 0;
  }));
}

function pickWeb(id) {
  editing = WEB.filter(function (p) { return p.id === id; })[0];
  if (!editing) return;
  editTrack = null; addImgs = []; setEditImages(editing.images);
  [].forEach.call(document.querySelectorAll('.item'), function (i) { i.classList.toggle('active', i.dataset.id === id); });
  // code ของชุดรูป marketplace — จับคู่จากโฟลเดอร์รูปก่อน (แม่นสุด) ไม่งั้นเดาจาก SKU แบบ BT-NN
  var bySlug = MKT.filter(function (m) { return m.slug && m.slug === editing.imgSlug; })[0];
  var guess = bySlug ? bySlug.code
    : (/^BT-(\d+)$/.test(editing.sku || '') ? editing.sku.replace(/^BT-/, '') : '');
  $('epane').innerHTML =
    loginBoxHtml() +
    '<div class="card"><h2>✏ ' + esc(editing.name) + '</h2>' +
    '<div class="sub">slug ' + esc(editing.slug) + ' · SKU ' + esc(editing.sku || '-') + ' · โฟลเดอร์รูป <b>' + esc(editing.imgSlug) + '</b></div>' +
    '<div id="eImages" class="imgs"></div>' +
    '<div class="f"><label>ชื่อสินค้า</label><input type="text" id="eName" value="' + esc(editing.name) + '"></div>' +
    '<div class="row">' +
    '<div class="f"><label>ราคา</label><input type="number" id="ePrice" value="' + editing.price + '"></div>' +
    '<div class="f"><label>สต็อก</label><input type="number" id="eStock" value="' + editing.stock + '"></div>' +
    '<div class="f"><label>หมวดหมู่</label><select id="eCat">' + META.categories.map(function (c) {
      return '<option' + (c === editing.category ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('') + '</select></div></div>' +
    '<div class="f"><label>รายละเอียด — 155 ตัวแรกคือ meta description</label><textarea id="eDesc">' + esc(editing.description) + '</textarea></div>' +
    '<div class="f"><label>Tags / คีย์เวิร์ด</label><input type="text" id="eTags" value="' + esc((editing.tags || []).join(', ')) + '"></div>' +
    '<div class="f"><label>เปลี่ยนรายชื่อเพลง (.txt — ไม่แนบ = ใช้ของเดิม ' + (editing.tracklist || []).length + ' เพลง)</label>' +
    '<input type="file" accept=".txt" onchange="readEditTxt(this)"><div class="hint" id="eTxtInfo"></div></div>' +
    '<hr style="border:0;border-top:1px solid #e2ded8;margin:16px 0">' +
    '<h2 style="font-size:15px">🖼 จัดการรูปสินค้า</h2>' +
    '<div class="sub">ลากรูปด้านบนเพื่อสลับลำดับ · กด × ลบ · กด ⭐ ตั้งเป็นรูปปก — แล้วกด "บันทึกรูป" ทีเดียว<br>ระบบดึงต้นฉบับจาก R2/NAS มาทำรูปใหม่ครบทั้ง 3 ชั้น + push ให้เอง</div>' +
    '<div id="eDrop" class="drop">ลากไฟล์รูปมาวางตรงนี้ หรือ<label class="pick"> เลือกไฟล์<input type="file" accept="image/*" multiple hidden onchange="pickAddImgs(this)"></label></div>' +
    '<div id="eAddPrev" class="imgs"></div><div class="hint" id="eAddInfo"></div>' +
    '<button class="primary" onclick="addImages(this)">💾 บันทึกรูป + อัปเดตเว็บ</button>' +
    '<button class="ghost" onclick="syncImages(this)" style="margin-left:8px">♻ ซิงก์รูปในโฟลเดอร์เข้าเว็บ</button>' +
    '<hr style="border:0;border-top:1px solid #e2ded8;margin:16px 0">' +
    '<h2 style="font-size:15px">🔁 ทำ SEO ใหม่ทั้งชุด</h2>' +
    '<div class="sub">พิมพ์ชื่อสั้นแบบที่ลูกค้าค้น แล้วให้ระบบเขียนชื่อ/รายละเอียด/tags/meta ใหม่ทับของเดิม</div>' +
    '<div class="row"><div class="f"><input type="text" id="eShort" placeholder="เช่น ลูกทุ่งอมตะ"></div>' +
    '<div class="f" style="flex:0 0 auto"><button class="ghost" onclick="regenSeo(this)">สร้าง SEO ใหม่ ✨</button></div></div>' +
    '<div id="eSeoBox"></div>' +
    '<div class="hint">ชื่อไฟล์รูปจะเปลี่ยนตามชื่อสินค้าใหม่โดยอัตโนมัติเมื่อกดบันทึก</div>' +
    '<div class="f"><label>ชุดรูป marketplace (ใช้ทำ xlsx)</label><select id="eCode"><option value="">— ไม่สร้าง xlsx —</option>' +
    MKT.map(function (m) {
      return '<option value="' + esc(m.code) + '"' + (m.code === guess ? ' selected' : '') + '>code ' + esc(m.code) + ' · ' + esc(m.title.slice(0, 60)) + '</option>';
    }).join('') + '</select><div class="hint">' + (guess
      ? '✔ จับคู่ให้อัตโนมัติแล้วจากโฟลเดอร์รูป' + (bySlug ? '' : ' (SKU)')
      : '⚠ จับคู่อัตโนมัติไม่ได้ — สินค้าเก่าที่ catalog ยังไม่มี slug ต้องเลือกเอง 1 ครั้ง หลังบันทึกรูปแล้วครั้งหน้าจะจำได้เอง'
    ) + '</div></div>' +
    '<div class="actions">' +
    '<button class="btn tiktok" onclick="genFor(this)">📦 สร้าง xlsx ทุกแพลตฟอร์ม</button>' +
    '<button class="primary" onclick="saveEdit(this)">💾 บันทึก + อัปเดตเว็บ</button></div>' +
    '<div class="st" id="eStatus"></div></div>';
  renderEditImages();
  renderAddPreview();
  bindDropZone();
}

// ลำดับนี้คือแกลเลอรีสินค้า และรูปแรกคือรูปปกที่แสดงบนการ์ดสินค้า
// editImages[i].k = index ของ "ต้นฉบับ" ใบนี้ตอนโหลดหน้า — server ใช้คัด/เรียงต้นฉบับตามนี้
// (ห้ามส่งแค่ URL รูปเว็บ ต้นฉบับบน R2 คนละชื่อกัน จับคู่กลับไม่ได้)
var dragFrom = -1;

// k อ่านจากเลขท้ายชื่อไฟล์ (<slug>-3.webp → ต้นฉบับใบที่ 3) ไม่ใช่ตำแหน่งในลิสต์
// เพราะลำดับใน DB อาจถูกสลับไว้ก่อนหน้าโดยที่ชื่อไฟล์ยังเรียงเหมือนเดิม
function setEditImages(urls) {
  var list = urls || [];
  var nums = list.map(function (u) {
    var m = String(u).match(/-(\d+)\.(webp|avif|jpe?g|png)$/i);
    return m ? parseInt(m[1], 10) - 1 : -1;
  });
  var ok = nums.every(function (n) { return n >= 0; }) && new Set(nums).size === nums.length;
  editImages = list.map(function (u, i) { return { url: u, k: ok ? nums[i] : i }; });
}

function editImageUrls() {
  return editImages.map(function (x) { return x.url; });
}

function renderEditImages() {
  var el = $('eImages');
  if (!el) return;
  if (!editImages.length) { el.innerHTML = '<div class="hint">ยังไม่มีรูปสินค้า</div>'; return; }
  el.innerHTML = editImages.map(function (x, i) {
    return '<div class="tile' + (i === 0 ? ' cover' : '') + '" draggable="true" data-i="' + i + '"' +
      ' ondragstart="imgDragStart(event,' + i + ')" ondragover="imgDragOver(event,' + i + ')"' +
      ' ondrop="imgDrop(event,' + i + ')" ondragend="imgDragEnd()">' +
      '<img src="' + esc(x.url) + '" alt="">' +
      '<button type="button" class="x" title="ลบรูปนี้" onclick="removeEditImage(' + i + ')">×</button>' +
      (i === 0 ? '<span class="badge">รูปปก</span>'
        : '<button type="button" class="star" title="ตั้งเป็นรูปปก" onclick="makeCover(' + i + ')">⭐</button>') +
      '<span class="n">' + (i + 1) + '</span></div>';
  }).join('');
}

function imgDragStart(e, i) { dragFrom = i; e.dataTransfer.effectAllowed = 'move'; }
function imgDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
function imgDragEnd() { dragFrom = -1; }
function imgDrop(e, to) {
  e.preventDefault();
  if (dragFrom < 0 || dragFrom === to) return;
  var moved = editImages.splice(dragFrom, 1)[0];
  editImages.splice(to, 0, moved);
  dragFrom = -1;
  renderEditImages();
}

function makeCover(i) {
  if (i <= 0) return;
  editImages.unshift(editImages.splice(i, 1)[0]);
  renderEditImages();
}

function removeEditImage(i) {
  if (editImages.length + addImgs.length <= 1) { alert('ต้องเหลือรูปอย่างน้อย 1 ใบ'); return; }
  editImages.splice(i, 1);
  renderEditImages();
  status('eStatus', 'ลบออกจากรายการแล้ว — กด "บันทึกรูป" เพื่อให้มีผลจริงบนเว็บ');
}

/** รูปใหม่ที่รออัป — โชว์พรีวิว + ลบทีละใบก่อนกดบันทึกได้ */
function renderAddPreview() {
  var el = $('eAddPrev'); if (!el) return;
  el.innerHTML = addImgs.map(function (f, i) {
    return '<div class="tile new"><img src="' + URL.createObjectURL(f) + '" alt="">' +
      '<button type="button" class="x" title="เอาออก" onclick="dropAddImg(' + i + ')">×</button>' +
      '<span class="badge">ใหม่</span></div>';
  }).join('');
  $('eAddInfo').textContent = addImgs.length
    ? '✔ รูปใหม่ ' + addImgs.length + ' ใบ — จะต่อท้ายรูปเดิม ' + editImages.length + ' ใบ (รวม ' + (addImgs.length + editImages.length) + ')'
    : '';
}

function dropAddImg(i) { addImgs.splice(i, 1); renderAddPreview(); }

function pickAddImgs(inp) { queueAddImgs(inp.files); inp.value = ''; }

function queueAddImgs(files) {
  var picked = [].slice.call(files).filter(function (f) { return /^image\//.test(f.type); });
  // เรียงชื่อไฟล์แบบเดียวกับ Explorer เพื่อให้ลำดับที่ได้ตรงกับที่เห็นในโฟลเดอร์
  picked.sort(function (a, b) { return a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }); });
  addImgs = addImgs.concat(picked);
  renderAddPreview();
}

function bindDropZone() {
  var z = $('eDrop'); if (!z) return;
  ['dragenter', 'dragover'].forEach(function (t) {
    z.addEventListener(t, function (e) { e.preventDefault(); z.classList.add('on'); });
  });
  ['dragleave', 'drop'].forEach(function (t) {
    z.addEventListener(t, function (e) { e.preventDefault(); z.classList.remove('on'); });
  });
  z.addEventListener('drop', function (e) { queueAddImgs(e.dataTransfer.files); });
}

async function syncImages(btn) {
  btn.disabled = true;
  try {
    await ensureLogin('eStatus');
    status('eStatus', '⏳ push รูปในโฟลเดอร์ → อัปเดต DB → sync products.json…');
    var out = await jpost('/api/sync-images', { id: editing.id, imgSlug: editing.imgSlug });
    editing.images = out.images;
    setEditImages(out.images);
    renderEditImages();
    status('eStatus', '<span class="ok">✔ ซิงก์แล้ว รวม ' + out.images.length + ' ใบ</span><br>' + esc(out.logs.join('\n')));
    WEB = await jget('/api/web-products');
  } catch (e) { status('eStatus', '✖ ' + esc(e.message).slice(0, 800), 'err'); }
  btn.disabled = false;
}

/** บันทึกรูป: ลบ + สลับลำดับ + เพิ่มรูปใหม่ ในรอบเดียว */
async function addImages(btn) {
  var keep = editImages.map(function (x) { return x.k; });
  var changed = addImgs.length || keep.length !== (editing.images || []).length ||
    keep.some(function (k, i) { return k !== i; });
  if (!changed) { status('eStatus', 'รูปยังไม่มีอะไรเปลี่ยน — ลากสลับลำดับ ลบ หรือเพิ่มรูปใหม่ก่อน', 'err'); return; }
  if (!keep.length && !addImgs.length) { status('eStatus', 'ต้องเหลือรูปอย่างน้อย 1 ใบ', 'err'); return; }
  if (!$('eCode').value) { status('eStatus', 'เลือกชุดรูป marketplace ก่อน — ต้องรู้เลขชุดถึงจะเก็บต้นฉบับถูกที่', 'err'); return; }
  btn.disabled = true;
  try {
    await ensureLogin('eStatus');
    status('eStatus', '⏳ กำลังอ่านรูป…');
    var imgs = [];
    for (var i = 0; i < addImgs.length; i++) imgs.push({ name: addImgs[i].name, data: await fileToB64(addImgs[i]) });
    status('eStatus', '⏳ ดึงต้นฉบับเดิม → ทำรูปใหม่ 3 ชั้น → build → push → อัปเดต DB… ใช้เวลาสักครู่');
    var out = await jpost('/api/add-images', {
      id: editing.id, code: $('eCode').value, imgSlug: editing.imgSlug,
      name: $('eName').value, folder: mktFolder($('eCode').value), images: imgs, keep: keep,
      existingCount: (editing.images || []).length
    });
    editing.images = out.images;
    setEditImages(out.images);
    renderEditImages();
    addImgs = [];
    renderAddPreview();
    status('eStatus', '<span class="ok">✔ บันทึกรูปแล้ว รวม ' + out.images.length + ' ใบ</span><br>' + esc(out.logs.join('\n')));
    WEB = await jget('/api/web-products');
  } catch (e) { status('eStatus', '✖ ' + esc(e.message).slice(0, 800), 'err'); }
  btn.disabled = false;
}

/** ชื่อโฟลเดอร์ NAS ของชุดรูป code นี้ (จาก catalog) — ไม่มีก็ปล่อยว่าง */
function mktFolder(code) {
  var m = MKT.filter(function (x) { return x.code === code; })[0];
  return m ? (m.dirName || null) : null;
}

function readEditTxt(inp) {
  var f = inp.files[0]; if (!f) return;
  f.text().then(function (txt) {
    editTrack = parseTracks(txt);
    $('eTxtInfo').textContent = '✔ อ่านได้ ' + editTrack.length + ' เพลง (จะทับของเดิมตอนบันทึก)';
  });
}

async function regenSeo(btn) {
  var short = $('eShort').value.trim();
  if (!short) { status('eStatus', 'ใส่ชื่อสั้นก่อนครับ', 'err'); return; }
  btn.disabled = true;
  try {
    var seo = await jpost('/api/seo', {
      shortName: short,
      tracklist: editTrack || editing.tracklist || [],
      capacity: (editing.specs && (editing.specs.capacity || editing.specs['ความจุ'])) || '4GB',
      price: +$('ePrice').value || editing.price,
      categoryName: $('eCat').value,
      excludeId: editing.id
    });
    $('eName').value = seo.name;
    $('eDesc').value = seo.description;
    $('eTags').value = (seo.tags || []).join(', ');
    editing.newSeo = seo;
    $('eSeoBox').innerHTML = serpHtml(seo) + issuesHtml(seo.issues) + '<div style="margin-top:6px">' + tagsHtml(seo.tags) + '</div>';
  } catch (e) { status('eStatus', '✖ ' + esc(e.message).slice(0, 400), 'err'); }
  btn.disabled = false;
}

async function saveEdit(btn) {
  btn.disabled = true;
  try {
    await ensureLogin('eStatus');
    status('eStatus', '⏳ กำลังอัปเดต… (rename รูป → build → push → DB → sync → push)');
    var seo = editing.newSeo;
    var body = {
      id: editing.id, code: $('eCode').value || null,
      name: $('eName').value, description: $('eDesc').value,
      price: +$('ePrice').value, stock: +$('eStock').value, categoryName: $('eCat').value,
      tags: $('eTags').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      slug: seo ? seo.slug : editing.slug,
      specs: seo ? seo.specs : undefined,
      images: editImageUrls(),
      imageUrl: editImageUrls()[0] || undefined,
      tracklist: editTrack || undefined,
      // เปลี่ยนชื่อโฟลเดอร์/ไฟล์รูปอัตโนมัติ เฉพาะเมื่อชื่อสินค้าเปลี่ยนจริง
      renameImages: $('eName').value.trim() !== editing.name,
      oldImgSlug: editing.imgSlug,
      newImgSlug: null
    };
    var out = await jpost('/api/update', body);
    status('eStatus', '<span class="ok">✔ อัปเดตแล้ว — <a href="' + out.url + '" target="_blank">' + out.url + '</a></span><br>' +
      esc(out.logs.join('\n')) + filesHtml(out.files));
    WEB = await jget('/api/web-products');
  } catch (e) { status('eStatus', '✖ ' + esc(e.message).slice(0, 800), 'err'); }
  btn.disabled = false;
}

async function genFor(btn) {
  var code = $('eCode').value;
  if (!code) { status('eStatus', 'เลือกชุดรูป marketplace ก่อนครับ', 'err'); return; }
  btn.disabled = true;
  status('eStatus', '⏳ กำลังสร้าง xlsx ทุกแพลตฟอร์ม…');
  try {
    var out = await jpost('/api/gen-all', { code: code });
    status('eStatus', '<span class="ok">✔ สร้างไฟล์แล้ว</span>' + filesHtml(out.files));
  } catch (e) { status('eStatus', '✖ ' + esc(e.message).slice(0, 400), 'err'); }
  btn.disabled = false;
}

/* ═════════ 3. QR ═════════ */
function renderQr() {
  html(
    '<div class="card"><h2>🔗 สร้าง QR Code</h2>' +
    '<div class="sub">อัปไฟล์ขึ้น img.btmusicdrive.com แล้วได้ QR 1200px พร้อมพิมพ์ (แปะโลโก้กลางได้)</div>' +
    '<div class="f"><label>ชื่อ (ใช้ตั้งชื่อไฟล์ QR)</label><input type="text" id="qName" placeholder="คาราบาว-รายชื่อเพลง"></div>' +
    '<div class="src"><input type="radio" name="qsrc" id="qsrcFile" checked>' +
    '<label for="qsrcFile" style="display:inline">อัปไฟล์ PDF / รูป / .txt รายชื่อเพลง</label>' +
    '<input type="file" id="qFile" accept=".pdf,.txt,image/*" style="margin-top:8px" onchange="document.getElementById(\'qsrcFile\').checked=true">' +
    '<div class="hint">.txt รายชื่อเพลง → ทำเป็นหน้าเว็บมีช่องค้นหาเพลงให้อัตโนมัติ · สแกนแล้วเปิดเต็มจอทันที ไม่ผ่าน Google Drive</div></div>' +
    '<div class="src"><input type="radio" name="qsrc" id="qsrcUrl">' +
    '<label for="qsrcUrl" style="display:inline">ใช้ลิงก์ที่มีอยู่แล้ว</label>' +
    '<input type="text" id="qUrl" placeholder="https://btmusicdrive.com/product/…" style="width:100%;margin-top:8px;border:1px solid #d6d3ce;border-radius:8px;padding:8px" onfocus="document.getElementById(\'qsrcUrl\').checked=true"></div>' +
    '<div class="actions"><button class="primary" onclick="createQr(this)">สร้าง QR ✨</button></div>' +
    '<div class="st" id="qStatus"></div></div>' +
    '<div class="card"><h2>📁 คลัง QR</h2><div id="qList" class="hint">กำลังโหลด…</div></div>'
  );
  loadQrList();
}
async function loadQrList() {
  var items = await jget('/api/qr-list');
  $('qList').innerHTML = items.length ? '<div class="qgrid">' + items.map(function (i) {
    return '<div class="qcard"><img src="/qr/' + encodeURIComponent(i.file) + '">' +
      '<div style="font-size:12px;font-weight:600;margin:6px 0 2px">' + esc(i.name) + '</div>' +
      '<div style="font-size:10px;color:#94a3b8;word-break:break-all;line-height:1.3">' + esc(i.url.replace('https://', '')) + '</div>' +
      '<div style="display:flex;gap:8px;justify-content:center;margin-top:4px">' +
      '<a href="' + esc(i.url) + '" target="_blank" style="font-size:12px">📄 เปิด</a>' +
      '<a href="/qr/' + encodeURIComponent(i.file) + '" download="' + esc(i.file) + '" style="font-size:12px">⬇ QR</a></div></div>';
  }).join('') + '</div>' : 'ยังไม่มี — สร้างอันแรกได้เลย';
}
async function createQr(btn) {
  var name = $('qName').value.trim();
  if (!name) { status('qStatus', 'ใส่ชื่อก่อนครับ', 'err'); return; }
  var useFile = $('qsrcFile').checked;
  var body = { name: name };
  if (useFile) {
    var f = $('qFile').files[0];
    if (!f) { status('qStatus', 'เลือกไฟล์ก่อนครับ', 'err'); return; }
    status('qStatus', '⏳ กำลังอ่านไฟล์…');
    body.file = { name: f.name, data: await fileToB64(f) };
  } else {
    body.url = $('qUrl').value.trim();
    if (!/^https?:\/\//.test(body.url)) { status('qStatus', 'ใส่ลิงก์ให้ถูก (ขึ้นต้น https://)', 'err'); return; }
  }
  btn.disabled = true;
  status('qStatus', '⏳ ' + (useFile ? 'อัปไฟล์ขึ้น R2 + สร้าง QR…' : 'สร้าง QR…'));
  try {
    var out = await jpost('/api/qr-create', body);
    status('qStatus', '<span class="ok">✔ เสร็จแล้ว — <a href="' + out.url + '" target="_blank">' + esc(out.url) + '</a></span>');
    loadQrList();
  } catch (e) { status('qStatus', '✖ ' + esc(e.message).slice(0, 400), 'err'); }
  btn.disabled = false;
}

/* ───────── boot ───────── */
(async function () {
  try {
    META = await jget('/api/meta');
    if (META.loggedIn) setLoggedIn();
    else {
      $('who').textContent = '🔑 ยังไม่ล็อกอิน — คลิกที่นี่ · ' + META.apiBase.replace('/api', '');
      showLoginGate();   // บังหน้าจอไว้เลย ไม่ให้เริ่มทำงานแล้วไปตายตอนท้าย
    }
    WEB = await jget('/api/web-products');
    MKT = await jget('/api/products');
  } catch (e) { $('who').textContent = 'โหลดข้อมูลไม่ได้'; }
  go('new');
})();
