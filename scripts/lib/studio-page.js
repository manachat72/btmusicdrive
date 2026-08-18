/**
 * หน้า UI ของ Product Studio (HTML + CSS)
 * client-side JS อยู่ไฟล์แยก studio-client.js แล้วเสิร์ฟที่ /studio.js
 * (แยกไว้เพื่อไม่ต้อง escape ${} ซ้อน template literal — แก้ง่าย พลาดยาก)
 */
const fs = require('fs');
const path = require('path');

const CLIENT_JS = fs.readFileSync(path.join(__dirname, 'studio-client.js'), 'utf8');

const CSS = `
:root { --primary:#8B7355; --dark:#0F172A; --line:#e2ded8; }
* { box-sizing:border-box; margin:0; }
body { font-family:'Segoe UI',Tahoma,sans-serif; background:#f6f4f1; color:#1e293b; }
header { background:var(--dark); color:#fff; padding:10px 20px; display:flex; align-items:center; gap:10px; position:sticky; top:0; z-index:5; }
header h1 { font-size:17px; font-weight:600; margin-right:6px; }
.tab { background:transparent; color:#cbd5e1; border:1px solid #334155; border-radius:99px; padding:7px 16px; font-size:13px; font-weight:600; cursor:pointer; }
.tab.on { background:var(--primary); color:#fff; border-color:var(--primary); }
header .right { margin-left:auto; display:flex; align-items:center; gap:10px; font-size:12px; color:#94a3b8; }
main { padding:18px 22px; max-width:1180px; margin:0 auto; }
.card { background:#fff; border:1px solid var(--line); border-radius:14px; padding:20px 22px; margin-bottom:16px; }
.card h2 { font-size:16px; margin-bottom:4px; }
.card .sub { font-size:12px; color:#94a3b8; margin-bottom:14px; }
.f { margin-bottom:13px; }
.f label { display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:5px; }
.f input[type=text], .f input[type=number], .f input[type=password], .f select, .f textarea {
  width:100%; border:1px solid #d6d3ce; border-radius:8px; padding:9px 12px; font-size:14px; font-family:inherit; background:#fff; }
.f textarea { min-height:200px; line-height:1.6; }
.row { display:flex; gap:13px; flex-wrap:wrap; } .row .f { flex:1; min-width:140px; }
.hint { font-size:12px; color:#94a3b8; margin-top:4px; line-height:1.5; }
.src { border:1px dashed #cbc7c0; border-radius:10px; padding:12px 14px; margin-bottom:10px; }
.src input[type=radio] { margin-right:8px; }
.primary { background:linear-gradient(135deg,#fbbf24,#f59e0b); color:#3b2f06; border:0; border-radius:10px; padding:12px 24px; font-size:15px; font-weight:700; cursor:pointer; }
.primary:disabled { opacity:.55; cursor:wait; }
.ghost { background:#eee; color:#334155; border:0; border-radius:10px; padding:12px 20px; font-size:14px; cursor:pointer; }
.actions { display:flex; gap:10px; justify-content:flex-end; margin-top:16px; flex-wrap:wrap; }
.thumbs { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
.thumbs img { width:64px; height:64px; object-fit:cover; border-radius:8px; border:1px solid var(--line); }
.imgs { display:grid; grid-template-columns:repeat(auto-fill,minmax(96px,1fr)); gap:10px; margin:10px 0 16px; }
.imgs a { position:relative; }
.imgs img { width:100%; aspect-ratio:1; object-fit:cover; border-radius:10px; border:1px solid var(--line); background:#eee; }
.imgs .cover::after { content:'ภาพปก'; position:absolute; top:6px; left:6px; background:var(--dark); color:#fff; font-size:10px; padding:2px 8px; border-radius:99px; }
.st { margin-top:12px; font-size:13px; color:#475569; white-space:pre-wrap; line-height:1.7; }
.ok { color:#15803d; } .err { color:#b91c1c; } .warnc { color:#b45309; }
.issues { border-radius:10px; padding:10px 14px; font-size:13px; line-height:1.8; margin:10px 0; }
.issues.warn { background:#fef3c7; border:1px solid #fcd34d; color:#92400e; }
.issues.error { background:#fee2e2; border:1px solid #fca5a5; color:#991b1b; }
.issues.good { background:#dcfce7; border:1px solid #86efac; color:#166534; }
.serp { border:1px solid var(--line); border-radius:10px; padding:14px 16px; background:#fff; margin:10px 0 4px; }
.serp .u { font-size:12px; color:#0f766e; }
.serp .t { font-size:18px; color:#1a0dab; line-height:1.35; margin:2px 0 3px; }
.serp .d { font-size:13px; color:#4d5156; line-height:1.55; }
.list { max-height:460px; overflow-y:auto; border:1px solid var(--line); border-radius:12px; background:#fff; }
.item { display:flex; gap:10px; padding:9px 12px; cursor:pointer; border-bottom:1px solid #f1eee9; align-items:center; }
.item:hover { background:#faf7f2; }
.item.active { background:#f3ecdf; border-left:4px solid var(--primary); padding-left:8px; }
.item img { width:46px; height:46px; object-fit:cover; border-radius:8px; background:#eee; flex:none; }
.item .t { font-size:13px; line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.item .m { font-size:11px; color:#94a3b8; margin-top:2px; }
.split { display:grid; grid-template-columns:minmax(280px,360px) 1fr; gap:16px; align-items:start; }
.btn { border:0; border-radius:12px; padding:12px 20px; font-size:14px; font-weight:600; cursor:pointer; color:#fff; display:inline-flex; align-items:center; gap:8px; }
.btn:disabled { opacity:.55; cursor:wait; }
.shopee { background:#ee4d2d; } .lazada { background:#0f146d; } .tiktok { background:#000; }
.files { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
.chk { font-size:13px; color:#475569; display:flex; align-items:center; gap:8px; margin:8px 0; }
.tag { display:inline-block; background:#f1eee9; border-radius:99px; padding:3px 10px; font-size:12px; margin:0 5px 5px 0; }
.qgrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; }
.qcard { border:1px solid var(--line); border-radius:10px; padding:10px; text-align:center; }
.qcard img { width:100%; border-radius:6px; }
@media (max-width:820px){ .split{grid-template-columns:1fr;} }
`;

const PAGE = `<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Product Studio — btmusicdrive</title>
<style>${CSS}</style></head><body>
<header>
  <h1>🎛 Product Studio</h1>
  <button class="tab on" id="tabNew" onclick="go('new')">➕ ลงสินค้าใหม่</button>
  <button class="tab" id="tabEdit" onclick="go('edit')">✏ แก้ไขสินค้า</button>
  <button class="tab" id="tabQr" onclick="go('qr')">🔗 QR</button>
  <div class="right"><span id="who">…</span></div>
</header>
<main id="view"></main>
<script src="/studio.js"></script>
</body></html>`;

module.exports = { PAGE, CLIENT_JS };
