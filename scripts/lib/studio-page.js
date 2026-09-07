/**
 * หน้า UI ของ Product Studio (HTML + CSS)
 * client-side JS อยู่ไฟล์แยก studio-client.js แล้วเสิร์ฟที่ /studio.js
 * (แยกไว้เพื่อไม่ต้อง escape ${} ซ้อน template literal — แก้ง่าย พลาดยาก)
 */
const fs = require('fs');
const path = require('path');

const CLIENT_JS = fs.readFileSync(path.join(__dirname, 'studio-client.js'), 'utf8');

const CSS = `
:root {
  --primary:#6f5a3f; --primary-soft:#f3eee7; --text:#242424; --muted:#6b7280;
  --line:#e5e7eb; --surface:#ffffff; --background:#f6f7f8; --danger:#b91c1c;
  --success:#15803d; --warning:#b45309; --sidebar:248px;
}
* { box-sizing:border-box; margin:0; }
html { background:var(--background); }
body { min-height:100vh; font-family:'Segoe UI',Tahoma,sans-serif; background:var(--background); color:var(--text); font-size:14px; }
button,input,select,textarea { font:inherit; }
button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,a:focus-visible { outline:3px solid rgba(111,90,63,.22); outline-offset:2px; }
.app-shell { min-height:100vh; display:grid; grid-template-columns:var(--sidebar) minmax(0,1fr); }
.sidebar { position:sticky; top:0; height:100vh; display:flex; flex-direction:column; background:var(--surface); border-right:1px solid var(--line); padding:20px 14px; z-index:10; }
.brand { display:flex; align-items:center; gap:11px; padding:0 10px 22px; }
.brand-mark { width:36px; height:36px; display:grid; place-items:center; border-radius:9px; background:#242424; color:#fff; font-weight:700; font-size:17px; }
.brand-copy strong { display:block; font-size:15px; letter-spacing:-.1px; }
.brand-copy span { display:block; margin-top:2px; color:var(--muted); font-size:11px; }
.nav-label { padding:0 10px 8px; color:#9ca3af; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; }
.sidebar-nav { display:flex; flex-direction:column; gap:4px; }
.tab { width:100%; display:flex; align-items:center; gap:11px; min-height:42px; padding:9px 11px; background:transparent; color:#4b5563; border:0; border-radius:7px; font-size:14px; font-weight:500; text-align:left; cursor:pointer; }
.tab:hover { background:#f5f5f5; color:#111827; }
.tab.on { background:var(--primary-soft); color:#493925; font-weight:600; }
.nav-icon { width:21px; height:21px; display:grid; place-items:center; font-size:17px; line-height:1; color:currentColor; }
.sidebar-footer { margin-top:auto; padding:14px 10px 2px; border-top:1px solid var(--line); }
.connection-label { display:block; color:#9ca3af; font-size:11px; margin-bottom:5px; }
#who { display:block; color:#4b5563; font-size:12px; line-height:1.45; cursor:pointer; overflow-wrap:anywhere; }
.workspace { min-width:0; }
.topbar { height:64px; position:sticky; top:0; z-index:6; display:flex; align-items:center; justify-content:space-between; gap:20px; padding:0 32px; background:rgba(255,255,255,.96); border-bottom:1px solid var(--line); }
.topbar-title { font-size:14px; font-weight:600; color:#374151; }
.topbar-actions { display:flex; align-items:center; gap:16px; }
.store-link { color:#4b5563; font-size:12px; text-decoration:none; }
.store-link:hover { color:var(--primary); text-decoration:underline; }
.content { width:100%; max-width:1160px; margin:0 auto; padding:30px 32px 48px; }
.page-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; margin-bottom:20px; }
.page-heading h1 { font-size:24px; line-height:1.25; letter-spacing:-.35px; font-weight:650; }
.page-heading p { margin-top:6px; color:var(--muted); line-height:1.5; }
.page-meta { flex:none; padding:6px 10px; border:1px solid var(--line); border-radius:999px; background:#fff; color:var(--muted); font-size:12px; }
.card { background:var(--surface); border:1px solid var(--line); border-radius:10px; padding:22px 24px; margin-bottom:18px; box-shadow:0 1px 2px rgba(17,24,39,.025); }
.card h2 { font-size:16px; font-weight:650; margin-bottom:5px; }
.card .sub { font-size:12px; color:var(--muted); line-height:1.5; margin-bottom:17px; }
.form-section { padding:0 0 22px; margin-bottom:22px; border-bottom:1px solid var(--line); }
.form-section:last-of-type { border-bottom:0; margin-bottom:0; }
.section-heading { display:flex; align-items:flex-start; gap:12px; margin-bottom:16px; }
.section-number { width:26px; height:26px; flex:none; display:grid; place-items:center; border-radius:7px; background:#f3f4f6; color:#4b5563; font-size:12px; font-weight:700; }
.section-heading h2 { font-size:15px; margin:1px 0 2px; }
.section-heading p { color:var(--muted); font-size:12px; line-height:1.45; }
.f { margin-bottom:15px; }
.f label { display:block; font-size:13px; font-weight:600; color:#374151; margin-bottom:6px; }
.f input[type=text],.f input[type=number],.f input[type=password],.f select,.f textarea {
  width:100%; min-height:42px; border:1px solid #d1d5db; border-radius:7px; padding:9px 11px; font-size:14px; color:#111827; background:#fff; transition:border-color .12s,box-shadow .12s;
}
.f input:hover,.f select:hover,.f textarea:hover { border-color:#9ca3af; }
.f input:focus,.f select:focus,.f textarea:focus { border-color:var(--primary); box-shadow:0 0 0 3px rgba(111,90,63,.1); outline:0; }
.f textarea { min-height:200px; line-height:1.6; resize:vertical; }
.row { display:flex; gap:14px; flex-wrap:wrap; }
.row .f { flex:1; min-width:150px; }
.hint { font-size:12px; color:var(--muted); margin-top:5px; line-height:1.5; }
.upload-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.src { position:relative; border:1px solid var(--line); border-radius:8px; padding:14px; margin-bottom:10px; background:#fff; }
.src:has(input[type=radio]:checked) { border-color:var(--primary); background:#fcfaf7; box-shadow:0 0 0 1px var(--primary); }
.src input[type=radio] { margin-right:8px; accent-color:var(--primary); }
.src select { min-height:40px; }
.mode-options { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.mode-option { display:flex; align-items:center; min-height:38px; padding:8px 11px; border:1px solid var(--line); border-radius:7px; background:#fff; color:#374151; }
.mode-option:has(input:checked) { border-color:var(--primary); background:var(--primary-soft); color:#493925; }
.mode-option input { margin-right:7px; accent-color:var(--primary); }
.primary,.ghost,.btn { min-height:42px; border-radius:7px; padding:10px 17px; font-size:14px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:7px; text-decoration:none; }
.primary { background:#242424; color:#fff; border:1px solid #242424; }
.primary:hover { background:#111; }
.primary:disabled,.btn:disabled { opacity:.55; cursor:wait; }
.ghost { background:#fff; color:#374151; border:1px solid #d1d5db; }
.ghost:hover { background:#f9fafb; border-color:#9ca3af; }
.actions { display:flex; gap:10px; justify-content:flex-end; align-items:center; margin-top:20px; flex-wrap:wrap; }
.form-actions { margin:0 -24px -22px; padding:18px 24px; background:#fafafa; border-top:1px solid var(--line); border-radius:0 0 10px 10px; }
.thumbs { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
.thumbs img { width:66px; height:66px; object-fit:cover; border-radius:7px; border:1px solid var(--line); }
.imgs { display:grid; grid-template-columns:repeat(auto-fill,minmax(96px,1fr)); gap:10px; margin:10px 0 18px; }
.imgs a { position:relative; }
.imgs img { width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px; border:1px solid var(--line); background:#f3f4f6; }
.imgs .cover::after { content:'ภาพปก'; position:absolute; top:6px; left:6px; background:#242424; color:#fff; font-size:10px; padding:3px 7px; border-radius:999px; }
.tile { position:relative; cursor:grab; }
.tile:active { cursor:grabbing; }
.tile.cover img { border-color:var(--primary); box-shadow:0 0 0 2px var(--primary); }
.tile .x,.tile .star { position:absolute; top:4px; border:0; border-radius:999px; width:25px; height:25px; line-height:1; font-size:13px; cursor:pointer; padding:0; opacity:0; transition:opacity .12s; }
.tile .x { right:4px; background:rgba(185,28,28,.92); color:#fff; }
.tile .star { left:4px; background:rgba(255,255,255,.96); }
.tile:hover .x,.tile:hover .star,.tile:focus-within .x,.tile:focus-within .star { opacity:1; }
.tile .badge { position:absolute; top:5px; left:5px; background:#242424; color:#fff; font-size:10px; padding:3px 7px; border-radius:999px; }
.tile .n { position:absolute; bottom:5px; right:5px; background:rgba(17,24,39,.78); color:#fff; font-size:10px; min-width:19px; text-align:center; padding:2px 5px; border-radius:999px; }
.tile.new img { border-color:var(--success); border-style:dashed; }
.drop { border:1px dashed #9ca3af; border-radius:8px; padding:24px; text-align:center; color:var(--muted); font-size:13px; margin:7px 0 10px; background:#fafafa; }
.drop.on { border-color:var(--primary); background:var(--primary-soft); color:var(--primary); }
.drop .pick { color:var(--primary); text-decoration:underline; cursor:pointer; }
.st { margin-top:13px; font-size:13px; color:#475569; white-space:pre-wrap; line-height:1.7; }
.ok { color:var(--success); } .err { color:var(--danger); } .warnc { color:var(--warning); }
.issues { border-radius:8px; padding:11px 13px; font-size:13px; line-height:1.7; margin:10px 0; }
.issues.warn { background:#fffbeb; border:1px solid #fde68a; color:#92400e; }
.issues.error { background:#fef2f2; border:1px solid #fecaca; color:#991b1b; }
.issues.good { background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; }
.serp { border:1px solid var(--line); border-radius:8px; padding:14px 16px; background:#fff; margin:10px 0 4px; }
.serp .u { font-size:12px; color:#0f766e; }
.serp .t { font-size:18px; color:#1a0dab; line-height:1.35; margin:2px 0 3px; }
.serp .d { font-size:13px; color:#4d5156; line-height:1.55; }
.list { max-height:calc(100vh - 190px); overflow-y:auto; border:1px solid var(--line); border-radius:9px; background:#fff; }
.item { display:flex; gap:11px; padding:10px 12px; cursor:pointer; border-bottom:1px solid #f0f1f2; align-items:center; }
.item:hover { background:#f9fafb; }
.item.active { background:var(--primary-soft); border-left:3px solid var(--primary); padding-left:9px; }
.item img { width:48px; height:48px; object-fit:cover; border-radius:7px; background:#eee; flex:none; }
.item .t { font-size:13px; line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.item .m { font-size:11px; color:var(--muted); margin-top:3px; }
.split { display:grid; grid-template-columns:minmax(290px,350px) minmax(0,1fr); gap:18px; align-items:start; }
.btn { border:0; color:#fff; }
.shopee { background:#ee4d2d; } .lazada { background:#0f146d; } .tiktok { background:#111; }
.files { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
.chk { font-size:13px; color:#475569; display:flex; align-items:center; gap:8px; margin:8px 0; }
.tag { display:inline-block; background:#f3f4f6; border-radius:999px; padding:4px 9px; font-size:12px; margin:0 5px 5px 0; }
.qgrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; }
.qcard { border:1px solid var(--line); border-radius:8px; padding:11px; text-align:center; background:#fff; }
.qcard img { width:100%; border-radius:6px; }
@media (max-width:820px) {
  .app-shell { grid-template-columns:1fr; }
  .sidebar { position:static; height:auto; padding:12px 14px 10px; border-right:0; border-bottom:1px solid var(--line); }
  .brand { padding:0 4px 10px; }
  .brand-copy span,.nav-label,.sidebar-footer { display:none; }
  .sidebar-nav { flex-direction:row; overflow-x:auto; }
  .tab { width:auto; flex:none; }
  .topbar { position:static; height:52px; padding:0 16px; }
  .content { padding:20px 16px 36px; }
  .split,.upload-row { grid-template-columns:1fr; }
  .page-heading { flex-direction:column; gap:10px; }
}
@media (max-width:520px) {
  .nav-icon { display:none; }
  .tab { min-height:38px; padding:8px 10px; font-size:13px; }
  .topbar-title { font-size:13px; }
  .store-link { display:none; }
  .card { padding:18px 16px; }
  .form-actions { margin:0 -16px -18px; padding:15px 16px; }
  .actions .primary,.actions .ghost { width:100%; }
}
`;

const PAGE = `<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Product Studio — btmusicdrive</title>
<style>${CSS}</style></head><body>
<div class="app-shell">
  <aside class="sidebar">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">BT</span>
      <div class="brand-copy"><strong>Product Studio</strong><span>ระบบจัดการสินค้าในเครื่อง</span></div>
    </div>
    <div class="nav-label">เมนูหลัก</div>
    <nav class="sidebar-nav" aria-label="เมนูหลัก">
      <button class="tab on" id="tabNew" onclick="go('new')"><span class="nav-icon" aria-hidden="true">＋</span>ลงสินค้าใหม่</button>
      <button class="tab" id="tabEdit" onclick="go('edit')"><span class="nav-icon" aria-hidden="true">✎</span>แก้ไขสินค้า</button>
      <button class="tab" id="tabQr" onclick="go('qr')"><span class="nav-icon" aria-hidden="true">⌁</span>QR Code</button>
    </nav>
    <div class="sidebar-footer">
      <span class="connection-label">สถานะการเชื่อมต่อ</span>
      <span id="who" onclick="openLogin()" title="คลิกเพื่อเข้าสู่ระบบแอดมิน">กำลังตรวจสอบ…</span>
    </div>
  </aside>
  <section class="workspace">
    <header class="topbar">
      <span class="topbar-title">ระบบจัดการร้านค้า</span>
      <div class="topbar-actions"><a class="store-link" href="https://btmusicdrive.com" target="_blank" rel="noreferrer">เปิดเว็บไซต์ ↗</a></div>
    </header>
    <main id="view" class="content"></main>
  </section>
</div>
<script src="/studio.js"></script>
</body></html>`;

module.exports = { PAGE, CLIENT_JS };
