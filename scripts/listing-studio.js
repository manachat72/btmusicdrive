#!/usr/bin/env node
/**
 * 🎛 Listing Studio — หน้าเว็บหลังบ้าน (local) สำหรับลงสินค้า
 *
 * ทำได้ 2 อย่าง:
 *   1. ลงสินค้าใหม่: ตั้งชื่อสั้น (เช่น "ฮิตยุค90") → เลือกรูปจากโฟลเดอร์ NAS หรืออัปโหลดรูป
 *      (สร้างโฟลเดอร์ให้เอง) → แนบ .txt รายชื่อเพลง → กดตกลง → ระบบแปลงรูปขึ้น R2 +
 *      ทำ SEO ตั้งชื่อ/รายละเอียดให้ → รีวิว/แก้ → ยืนยันลงเว็บ btmusicdrive.com ก่อน
 *   2. กระจายไปแพลตฟอร์ม: เลือกสินค้า → กดปุ่มสร้าง template.xlsx ของ Shopee / TikTok / Lazada
 *
 * การลงเว็บใช้ API จริง (ต้อง login ด้วยบัญชีแอดมินในหน้านี้ก่อน) — มีขั้นรีวิวเสมอ ไม่ลงอัตโนมัติ
 *
 * Usage: npm run mkt:studio   → เปิด http://localhost:4777
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const XLSX = require('xlsx');
const QRCode = require('qrcode');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'templates');
const PORT = 4777;
const NAS_DIR = 'Z:\\รูป\\รูปสินค้า';
const API_BASE = process.argv.includes('--local-api') ? 'http://localhost:5000/api' : 'https://btmusicdrive.com/api';
const CDN = 'https://img.btmusicdrive.com';

let ADMIN_TOKEN = null;   // JWT หลัง login (เก็บในหน่วยความจำระหว่างเปิด studio เท่านั้น)

// ── SEO builders (แนวเดียวกับ generate-marketplace-listings.js) ──
const GENRES = [
  { re: /เพื่อชีวิต|คาราบาว|พงษ์สิทธิ์|คำภีร์|มาลีฮวนน่า/, name: 'เพื่อชีวิต', cat: 'เพื่อชีวิต', kw: ['เพลงเพื่อชีวิต', 'เพลงเพื่อชีวิตเก่า', 'เพลงในตำนาน'] },
  { re: /ลูกทุ่ง|หมอลำ|อีสาน|พุ่มพวง|ครูสลา/, name: 'ลูกทุ่ง', cat: 'ลูกทุ่ง', kw: ['เพลงลูกทุ่ง', 'ลูกทุ่งเก่า', 'ลูกทุ่งฮิต'] },
  { re: /ลูกกรุง|สุนทราภรณ์/, name: 'ลูกกรุง', cat: 'ลูกกรุง', kw: ['เพลงลูกกรุง', 'เพลงเก่าอมตะ', 'เพลงอมตะ'] },
  { re: /ใต้|สตอ|สำเนียงใต้/, name: 'เพลงใต้', cat: 'เพลงใต้', kw: ['เพลงใต้', 'เพลงใต้เก่า', 'สำเนียงใต้'] },
  { re: /ร็อค|โลโซ|bodyslam|ลาบานูน/i, name: 'ร็อคไทย', cat: 'เพลงสตริง', kw: ['เพลงร็อค', 'ร็อคไทย', 'ร็อคยุค 90'] },
  { re: /สากล|international/i, name: 'สากล', cat: 'เพลงสากล', kw: ['เพลงสากล', 'เพลงสากลเก่า', 'เพลงฮิตสากล'] },
  { re: /แดนซ์|dance|3 ?ช่า|สามช่า|มันส์/i, name: 'แดนซ์', cat: 'แดนซ์', kw: ['เพลงแดนซ์', 'เพลงมันส์', 'เพลงปาร์ตี้'] },
  { re: /ธรรมะ|สวดมนต์|คาถา|นิยายเสียง/, name: 'ธรรมะ', cat: 'ธรรมะ', kw: ['ธรรมะ', 'เสียงสวดมนต์', 'ฟังธรรมะ'] },
  { re: /วิทยุ|radio/i, name: 'วิทยุ', cat: 'วิทยุ', kw: ['วิทยุพกพา', 'วิทยุ FM', 'วิทยุเสียบ USB'] },
  { re: /otg|หัวแปลง|adapter/i, name: 'อุปกรณ์เสริม', cat: 'อุปกรณ์เสริม', kw: ['อุปกรณ์เสริม', 'OTG', 'หัวแปลง USB'] },
  { re: /สตริง|ยุค ?90|ยุค ?80|ยุค ?2000|tiktok|ฮิต/i, name: 'สตริง', cat: 'เพลงสตริง', kw: ['เพลงสตริง', 'เพลงเก่า', 'เพลงฮิตยุค 90'] },
];
const CATEGORIES = ['เพื่อชีวิต', 'เพลงสตริง', 'เพลงใต้', 'เพลงสากล', 'ลูกกรุง', 'ลูกทุ่ง', 'อุปกรณ์เสริม', 'แดนซ์', 'วิทยุ', 'ธรรมะ'];

function buildSeoDraft({ shortName, songs, capacity, price }) {
  const g = GENRES.find(x => x.re.test(shortName)) || { name: 'เพลงฮิต', cat: 'เพลงสตริง', kw: ['เพลงฮิต', 'รวมเพลง', 'เพลงเพราะ'] };
  const era = (shortName.match(/ยุค ?(\d{2,4})/) || [])[1] || null;
  const n = songs ? `${songs} เพลง` : 'เพลงฮิตจัดเต็ม';
  const name = `USB แฟลชไดรฟ์ MP3 รวมเพลง${shortName} ${songs ? songs + ' เพลง ' : ''}${capacity} ฟังในรถ ไม่ต้องเน็ต`.replace(/\s{2,}/g, ' ');
  const description = [
    `รวมเพลง${shortName} ${era ? `ยุค ${era} ` : ''}${n} อัดลงแฟลชไดรฟ์ USB พร้อมฟังทันที เสียบปุ๊บเล่นปั๊บ ไม่ต้องต่อเน็ต ไม่ต้องโหลดแอป ไม่มีโฆษณาคั่น`,
    '',
    'สิ่งที่คุณได้รับ:',
    `• ${n} คัดมาให้แล้ว — ไม่ต้องเสียเวลาหาเอง`,
    '• ไฟล์ MP3 320kbps เสียงคมชัด เบสแน่น ฟังในรถได้อารมณ์เต็ม',
    '• ใช้ได้กับรถยนต์ทุกรุ่นที่มีช่อง USB, ลำโพงบลูทูธ, คอม, สมาร์ททีวี',
    '• ตั้งชื่อไฟล์เรียงเลขเป็นระเบียบ เลื่อนหาเพลงง่าย มีรายชื่อเพลงครบ',
    '• เพิ่ม-ลบเพลงเองได้ ใช้เป็นแฟลชไดรฟ์เก็บไฟล์ต่อได้',
    '',
    `เหมาะสำหรับ: คนขับรถที่อยากฟังเพลงโดยไม่ง้อเน็ต · คนชอบ${g.name} · ซื้อเป็นของขวัญให้พ่อแม่ผู้ใหญ่ ใช้ง่าย ไม่ต้องสอน`,
    '',
    `ความจุ: ${capacity} · คุณภาพเสียง: MP3 320kbps · ราคา ${price} บาท`,
    'ส่งไวจากไทย แพ็กกันกระแทก มีปัญหาเปลี่ยนใหม่ภายใน 7 วัน',
  ].join('\n');
  return { name, description, categoryName: g.cat, tags: [...g.kw, 'USB เพลง', 'แฟลชไดรฟ์เพลง', 'เพลงในรถ'].slice(0, 8) };
}

// ── data helpers ──
function loadProducts() {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'marketplace-images', 'catalog.json'), 'utf8')).products;
  const listFile = path.join(OUT_DIR, 'marketplace-listings.xlsx');
  const meta = {};
  if (fs.existsSync(listFile)) {
    const wb = XLSX.read(fs.readFileSync(listFile), { type: 'buffer' });
    for (const r of XLSX.utils.sheet_to_json(wb.Sheets['TikTok Shop'] || {}, { defval: '' })) {
      meta[String(r.Code).padStart(2, '0')] = { price: r['ราคา'], stock: r['สต็อก'], sku: r['SKU'], note: r['หมายเหตุ'] };
    }
  }
  return catalog.map(p => ({ code: p.code, title: p.title, images: p.images, count: p.images.length, ...(meta[p.code] || {}) }));
}

function nasFolders() {
  try {
    return fs.readdirSync(NAS_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => {
      let n = 0;
      try { n = fs.readdirSync(path.join(NAS_DIR, d.name)).filter(f => /\.(jpe?g|png|webp|avif)$/i.test(f)).length; } catch { }
      return { name: d.name, count: n };
    }).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  } catch { return null; }   // null = เข้าถึง NAS ไม่ได้
}

function nextCode() {
  const codes = (nasFolders() || []).map(f => parseInt((f.name.match(/^(\d+)/) || [])[1] || '0', 10));
  return String(Math.max(0, ...codes) + 1).padStart(2, '0');
}

function runScript(script, args) {
  execFileSync(process.execPath, [path.join(__dirname, script), ...args], { cwd: ROOT, stdio: 'pipe' });
}

function genFile(platform, code) {
  code = String(code).padStart(2, '0');
  if (platform === 'shopee') { runScript('fill-shopee-template.js', ['--apply', '--code', code]); return path.join(OUT_DIR, `shopee-upload-${code}.xlsx`); }
  if (platform === 'tiktok') { runScript('fill-tiktok-template.js', ['--apply', '--code', code]); return path.join(OUT_DIR, `tiktok-upload-${code}.xlsx`); }
  if (platform === 'lazada') {
    const wb0 = XLSX.read(fs.readFileSync(path.join(OUT_DIR, 'marketplace-listings.xlsx')), { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(wb0.Sheets['Lazada'], { header: 1, defval: '' });
    const hit = rows.filter((r, i) => i === 0 || String(r[0]).padStart(2, '0') === code);
    if (hit.length < 2) throw new Error(`ไม่พบ code ${code} ในชีต Lazada`);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(hit);
    ws['!cols'] = [6, 60, 50, 80, 30, 8, 6, 10, 12, 10, 5, 5, 5, ...Array(9).fill(45), 8, 30].map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, 'Lazada');
    const out = path.join(OUT_DIR, `lazada-upload-${code}.xlsx`);
    XLSX.writeFile(wb, out, { bookType: 'xlsx' });
    return out;
  }
  throw new Error('platform ไม่ถูกต้อง');
}

// ── QR: คลังเก็บ + สร้าง ──
const QR_DIR = path.join(ROOT, 'qr');
const QR_REG = path.join(QR_DIR, 'qr-registry.json');
const loadQrReg = () => { try { return JSON.parse(fs.readFileSync(QR_REG, 'utf8')); } catch { return []; } };
const saveQrReg = (items) => { fs.mkdirSync(QR_DIR, { recursive: true }); fs.writeFileSync(QR_REG, JSON.stringify(items, null, 2), 'utf8'); };

function uploadToR2(localFile, remoteKey) {
  const out = execFileSync(process.execPath,
    [path.join(__dirname, 'upload-r2-file.js'), localFile, remoteKey, '--force'],
    { cwd: ROOT, stdio: 'pipe' }).toString();
  const m = out.match(/https:\/\/\S+/);
  if (!m) throw new Error('อัป R2 ไม่สำเร็จ: ' + out.slice(0, 300));
  return m[0];
}

/** .txt รายชื่อเพลง → หน้าเว็บธีมทอง-ดำ (มือถือ + ช่องค้นหา) สำหรับให้ลูกค้าสแกนดู */
function tracklistHtml(title, rawText) {
  const lines = String(rawText).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const rows = [];
  let count = 0;
  for (const l of lines) {
    const m = l.match(/^(\d+)\s*[.)\-]?\s*(.+)$/);
    if (m) { count++; rows.push(`<li><span>${m[1].padStart(3, '0')}</span>${m[2].replace(/\[official.*?\]|\.mp3$/gi, '').trim()}</li>`); }
    else rows.push(`<li class="al">${l}</li>`);   // บรรทัดไม่มีเลข = หัวข้อ/ชื่ออัลบั้ม
  }
  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — รายชื่อเพลง</title>
<style>
  * { box-sizing:border-box; margin:0; }
  body { font-family:'Segoe UI',Tahoma,sans-serif; background:#100d08; color:#e8ddc8; padding:0 0 40px; }
  header { background:linear-gradient(180deg,#1a1508,#100d08); text-align:center; padding:28px 16px 18px; border-bottom:2px solid #8B7355; position:sticky; top:0; }
  h1 { font-size:22px; color:#f5c343; letter-spacing:.5px; }
  .n { color:#b3a180; font-size:14px; margin-top:4px; }
  .search { margin:12px auto 0; max-width:420px; }
  .search input { width:100%; padding:10px 16px; border-radius:99px; border:1px solid #8B7355; background:#1c1710; color:#e8ddc8; font-size:15px; outline:none; }
  ol { list-style:none; max-width:560px; margin:14px auto; padding:0 16px; }
  li { padding:7px 10px; border-bottom:1px solid #241d12; font-size:15px; display:flex; gap:10px; }
  li span { color:#8B7355; font-variant-numeric:tabular-nums; flex:none; }
  li.al { background:#1c1710; color:#f5c343; font-weight:600; border-radius:8px; margin:14px 0 4px; border:0; display:block; }
  footer { text-align:center; color:#6b5d45; font-size:12px; margin-top:26px; }
  footer a { color:#f5c343; }
</style></head><body>
<header><h1>${title}</h1><div class="n">รายชื่อเพลงทั้งหมด ${count} เพลง</div>
<div class="search"><input id="q" placeholder="🔍 ค้นหาเพลง…" oninput="f(this.value)"></div></header>
<ol id="list">${rows.join('')}</ol>
<footer>BT Music Drive · <a href="https://btmusicdrive.com">btmusicdrive.com</a></footer>
<script>function f(q){q=q.toLowerCase();document.querySelectorAll('#list li').forEach(li=>{li.style.display=!q||li.textContent.toLowerCase().includes(q)?'':'none'})}</script>
</body></html>`;
}

async function makeQr({ name, url }) {
  const safe = String(name || 'qr').trim().replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 60) || 'qr';
  const file = `qr-${safe}.png`;
  fs.mkdirSync(QR_DIR, { recursive: true });
  await QRCode.toFile(path.join(QR_DIR, file), url, {
    errorCorrectionLevel: 'H', width: 1200, margin: 3,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
  const items = loadQrReg().filter(i => i.file !== file);
  items.unshift({ name: String(name || safe), url, file, createdAt: new Date().toISOString() });
  saveQrReg(items);
  return { name: String(name || safe), url, file };
}

async function api(pathname, opts = {}) {
  const r = await fetch(API_BASE + pathname, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(ADMIN_TOKEN ? { authorization: `Bearer ${ADMIN_TOKEN}` } : {}), ...(opts.headers || {}) },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `${r.status} ${r.statusText}`);
  return body;
}

// ── หน้าเว็บ ──
const PAGE = /* html */ `<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Listing Studio — btmusicdrive</title>
<style>
  :root { --primary:#8B7355; --dark:#0F172A; }
  * { box-sizing:border-box; margin:0; }
  body { font-family:'Segoe UI',Tahoma,sans-serif; background:#f6f4f1; color:#1e293b; }
  header { background:var(--dark); color:#fff; padding:12px 22px; display:flex; align-items:center; gap:12px; position:sticky; top:0; z-index:5; }
  header h1 { font-size:18px; font-weight:600; }
  header .badge { background:var(--primary); border-radius:99px; padding:2px 12px; font-size:12px; }
  header input { border:0; border-radius:8px; padding:8px 14px; width:min(280px,32vw); font-size:14px; }
  .newbtn { margin-left:auto; background:linear-gradient(135deg,#fbbf24,#f59e0b); color:#3b2f06; border:0; border-radius:10px; padding:10px 18px; font-size:14px; font-weight:700; cursor:pointer; }
  main { display:grid; grid-template-columns:minmax(300px,380px) 1fr; height:calc(100vh - 56px); }
  #list { overflow-y:auto; border-right:1px solid #e2ded8; background:#fff; }
  .item { display:flex; gap:10px; padding:10px 14px; cursor:pointer; border-bottom:1px solid #f1eee9; align-items:center; }
  .item:hover { background:#faf7f2; } .item.active { background:#f3ecdf; border-left:4px solid var(--primary); padding-left:10px; }
  .item img { width:52px; height:52px; object-fit:cover; border-radius:8px; background:#eee; flex:none; }
  .item .t { font-size:13px; line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .item .m { font-size:11px; color:#94a3b8; margin-top:2px; }
  #detail { overflow-y:auto; padding:22px 26px; }
  #detail .empty { color:#94a3b8; text-align:center; margin-top:16vh; font-size:15px; line-height:2; }
  h2 { font-size:17px; line-height:1.4; margin-bottom:4px; }
  .meta { color:#64748b; font-size:13px; margin-bottom:14px; } .meta b { color:var(--primary); }
  .warn { background:#fef3c7; border:1px solid #fcd34d; color:#92400e; border-radius:8px; padding:8px 12px; font-size:13px; margin-bottom:14px; display:inline-block; }
  .imgs { display:grid; grid-template-columns:repeat(auto-fill,minmax(110px,1fr)); gap:10px; margin-bottom:22px; }
  .imgs a { position:relative; } .imgs img { width:100%; aspect-ratio:1; object-fit:cover; border-radius:10px; border:1px solid #e2ded8; background:#eee; }
  .imgs .cover::after { content:'ภาพปก'; position:absolute; top:6px; left:6px; background:var(--dark); color:#fff; font-size:10px; padding:2px 8px; border-radius:99px; }
  h3 { font-size:14px; color:#475569; margin:18px 0 10px; }
  .btns { display:flex; flex-wrap:wrap; gap:12px; }
  .btn { border:0; border-radius:12px; padding:14px 22px; font-size:15px; font-weight:600; cursor:pointer; color:#fff; display:flex; align-items:center; gap:8px; box-shadow:0 2px 6px rgb(15 23 42 / .12); }
  .btn:disabled { opacity:.55; cursor:wait; }
  .btn small { font-weight:400; opacity:.85; font-size:11px; display:block; text-align:left; }
  .shopee { background:#ee4d2d; } .lazada { background:#0f146d; } .tiktok { background:#000; }
  #status, .st { margin-top:14px; font-size:13px; color:#475569; min-height:20px; white-space:pre-wrap; }
  .ok { color:#15803d; } .err { color:#b91c1c; }
  /* modal ลงสินค้าใหม่ */
  #overlay { position:fixed; inset:0; background:rgb(15 23 42 / .55); display:none; z-index:10; overflow-y:auto; }
  #overlay.show { display:block; }
  .modal { background:#fff; border-radius:16px; max-width:720px; margin:5vh auto; padding:26px 30px; }
  .modal h2 { margin-bottom:16px; }
  .f { margin-bottom:14px; }
  .f label { display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:5px; }
  .f input[type=text], .f input[type=number], .f select, .f textarea { width:100%; border:1px solid #d6d3ce; border-radius:8px; padding:9px 12px; font-size:14px; font-family:inherit; }
  .f textarea { min-height:180px; line-height:1.55; }
  .row { display:flex; gap:14px; } .row .f { flex:1; }
  .src { border:1px dashed #cbc7c0; border-radius:10px; padding:12px 14px; margin-bottom:10px; }
  .src input[type=radio] { margin-right:8px; }
  .hint { font-size:12px; color:#94a3b8; margin-top:4px; }
  .primary { background:linear-gradient(135deg,#fbbf24,#f59e0b); color:#3b2f06; border:0; border-radius:10px; padding:12px 26px; font-size:15px; font-weight:700; cursor:pointer; }
  .ghost { background:#eee; color:#334155; border:0; border-radius:10px; padding:12px 20px; font-size:14px; cursor:pointer; }
  .primary:disabled { opacity:.6; cursor:wait; }
  .thumbs { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
  .thumbs img { width:64px; height:64px; object-fit:cover; border-radius:8px; border:1px solid #e2ded8; }
  .login { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px; margin-bottom:14px; }
  @media (max-width:760px){ main{grid-template-columns:1fr;} }
</style></head><body>
<header>
  <h1>🎛 Listing Studio</h1><span class="badge">btmusicdrive หลังบ้าน</span>
  <input id="q" placeholder="ค้นหาสินค้า… (ชื่อ / code)" autocomplete="off">
  <button class="newbtn" onclick="openNew()">➕ ลงสินค้าใหม่</button>
  <button class="newbtn" style="background:#0F172A;color:#fff;border:1px solid #8B7355" onclick="openQr()">🔗 QR</button>
</header>
<main>
  <div id="list"></div>
  <div id="detail"><div class="empty">← เลือกสินค้าเพื่อกระจายไปแพลตฟอร์ม<br>หรือกด <b>➕ ลงสินค้าใหม่</b> มุมขวาบน — ลงเว็บก่อน แล้วค่อยกระจาย</div></div>
</main>

<div id="overlay"><div class="modal" id="modalBody"></div></div>

<script>
let PRODUCTS = [], current = null, FOLDERS = null, CATS = [], draft = null, upImages = [], trackList = [];

async function load() {
  PRODUCTS = await (await fetch('/api/products')).json();
  render(PRODUCTS);
}
function render(items) {
  document.getElementById('list').innerHTML = items.map(p => \`
    <div class="item" data-code="\${p.code}" onclick="pick('\${p.code}')">
      <img loading="lazy" src="\${p.images[0] || ''}" alt="">
      <div><div class="t">\${esc(p.title)}</div>
      <div class="m">code \${p.code} · \${p.count} รูป · ฿\${p.price ?? '-'}\${p.note ? ' · ⚠' : ''}</div></div>
    </div>\`).join('');
}
function esc(s){ return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function pick(code) {
  current = PRODUCTS.find(p => p.code === code);
  document.querySelectorAll('.item').forEach(i => i.classList.toggle('active', i.dataset.code === code));
  document.getElementById('detail').innerHTML = \`
    <h2>\${esc(current.title)}</h2>
    <div class="meta">code <b>\${current.code}</b> · SKU \${esc(current.sku ?? '-')} · ราคา <b>฿\${current.price ?? '-'}</b> · สต็อก \${current.stock ?? '-'} · รูป \${current.count}</div>
    \${current.note ? '<div class="warn">⚠ ' + esc(current.note) + '</div>' : ''}
    <div class="imgs">\${current.images.map((u,i) => \`<a href="\${u}" target="_blank" class="\${i===0?'cover':''}"><img loading="lazy" src="\${u}"></a>\`).join('')}</div>
    <h3>กระจายไปแพลตฟอร์ม — กดแล้วได้ .xlsx ไปอัปโหลดที่ Seller Center</h3>
    <div class="btns">
      <button class="btn shopee" onclick="gen(this,'shopee')">🟠 Shopee<small>เทมเพลตทางการ พร้อมอัป</small></button>
      <button class="btn tiktok" onclick="gen(this,'tiktok')">⬛ TikTok Shop<small>เทมเพลตทางการ พร้อมอัป</small></button>
      <button class="btn lazada" onclick="gen(this,'lazada')">🔵 Lazada<small>ข้อมูลครบ copy ลงเทมเพลต</small></button>
    </div>
    <div id="status"></div>\`;
}
async function gen(btn, platform) {
  const st = document.getElementById('status');
  btn.disabled = true; st.innerHTML = '⏳ กำลังสร้างไฟล์ ' + platform + '…';
  try {
    const r = await fetch('/api/generate?platform=' + platform + '&code=' + current.code);
    if (!r.ok) throw new Error(await r.text());
    const blob = await r.blob();
    const name = r.headers.get('x-filename') || (platform + '-' + current.code + '.xlsx');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
    a.click(); URL.revokeObjectURL(a.href);
    st.innerHTML = '<span class="ok">✔ ดาวน์โหลด ' + name + ' แล้ว</span>';
  } catch (e) { st.innerHTML = '<span class="err">✖ ' + esc(e.message).slice(0, 400) + '</span>'; }
  btn.disabled = false;
}
document.getElementById('q').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  render(PRODUCTS.filter(p => p.title.toLowerCase().includes(q) || p.code.includes(q)));
});

/* ───────── ลงสินค้าใหม่ ───────── */
async function openNew() {
  const meta = await (await fetch('/api/meta')).json();
  FOLDERS = meta.folders; CATS = meta.categories;
  upImages = []; trackList = []; draft = null;
  document.getElementById('overlay').classList.add('show');
  document.getElementById('modalBody').innerHTML = \`
    <h2>➕ ลงสินค้าใหม่ <span style="font-size:13px;color:#94a3b8;font-weight:400">(code ถัดไป: \${meta.nextCode})</span></h2>
    <div class="f"><label>ชื่อสินค้าแบบสั้น (เช่น ฮิตยุค90, ลูกทุ่งอมตะ)</label>
      <input type="text" id="nName" placeholder="ฮิตยุค90"></div>
    <div class="row">
      <div class="f"><label>ราคา (บาท)</label><input type="number" id="nPrice" value="279"></div>
      <div class="f"><label>ความจุ</label><select id="nCap"><option>512MB</option><option>1GB</option><option>2GB</option><option selected>4GB</option><option>8GB</option><option>16GB</option><option>32GB</option></select></div>
    </div>
    <div class="f"><label>รูปสินค้า</label>
      <div class="src"><input type="radio" name="src" id="srcNas" value="nas" \${FOLDERS ? '' : 'disabled'} checked>
        <label for="srcNas" style="display:inline">เลือกโฟลเดอร์ที่มีอยู่บน NAS</label>
        <select id="nFolder" style="width:100%;margin-top:8px;border:1px solid #d6d3ce;border-radius:8px;padding:8px">
          \${FOLDERS ? FOLDERS.map(f => \`<option value="\${esc(f.name)}">\${esc(f.name)} (\${f.count} รูป)</option>\`).join('') : '<option>เข้าถึง NAS ไม่ได้</option>'}
        </select></div>
      <div class="src"><input type="radio" name="src" id="srcUp" value="upload" \${FOLDERS ? '' : 'checked'}>
        <label for="srcUp" style="display:inline">อัปโหลดรูปใหม่ (สร้างโฟลเดอร์บน NAS ให้เอง)</label>
        <input type="file" id="nFiles" accept="image/*" multiple style="margin-top:8px" onchange="previewFiles(this)">
        <div class="hint">รูปแรก = ภาพปก · สูงสุด 9 รูป · จะบันทึกเป็น หลัก_01.jpg, หลัก_02.jpg …</div>
        <div class="thumbs" id="thumbs"></div></div>
    </div>
    <div class="f"><label>📄 รายชื่อเพลง (.txt — 1 เพลงต่อบรรทัด)</label>
      <input type="file" id="nTxt" accept=".txt" onchange="readTxt(this)">
      <div class="hint" id="txtInfo">ยังไม่ได้แนบไฟล์ (ไม่บังคับ แต่แนะนำ — ใช้ทำ SEO และโชว์รายชื่อเพลงบนเว็บ)</div></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
      <button class="ghost" onclick="closeNew()">ยกเลิก</button>
      <button class="primary" id="goBtn" onclick="createDraft(this)">ตกลง → ทำ SEO ✨</button>
    </div>
    <div class="st" id="nStatus"></div>\`;
}
function closeNew(){ document.getElementById('overlay').classList.remove('show'); }
function previewFiles(inp) {
  document.getElementById('srcUp').checked = true;
  upImages = [...inp.files].slice(0, 9);
  const t = document.getElementById('thumbs'); t.innerHTML = '';
  upImages.forEach(f => { const img = document.createElement('img'); img.src = URL.createObjectURL(f); t.appendChild(img); });
}
function readTxt(inp) {
  const f = inp.files[0]; if (!f) return;
  f.text().then(txt => {
    trackList = txt.split(/\\r?\\n/).map(s => s.replace(/^\\s*\\d+[.)\\-]?\\s*/, '').trim()).filter(Boolean);
    document.getElementById('txtInfo').textContent = '✔ อ่านได้ ' + trackList.length + ' เพลง — ' + trackList.slice(0,3).join(' / ') + (trackList.length > 3 ? ' …' : '');
  });
}
function fileToB64(f){ return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result.split(',')[1]); r.onerror = no; r.readAsDataURL(f); }); }

async function createDraft(btn) {
  const name = document.getElementById('nName').value.trim();
  const st = document.getElementById('nStatus');
  if (!name) { st.innerHTML = '<span class="err">ใส่ชื่อสินค้าก่อนครับ</span>'; return; }
  const useNas = document.getElementById('srcNas')?.checked;
  const body = { name, price: +document.getElementById('nPrice').value || 279, capacity: document.getElementById('nCap').value, tracklist: trackList };
  if (useNas) body.folder = document.getElementById('nFolder').value;
  else {
    if (!upImages.length) { st.innerHTML = '<span class="err">เลือกรูปก่อนครับ</span>'; return; }
    st.innerHTML = '⏳ กำลังอ่านรูป…';
    body.images = [];
    for (const f of upImages) body.images.push({ name: f.name, data: await fileToB64(f) });
  }
  btn.disabled = true;
  st.innerHTML = '⏳ กำลังแปลงรูป → อัปขึ้น R2 → ทำ SEO… (อาจใช้เวลาสักครู่)';
  try {
    const r = await fetch('/api/new-product', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    draft = await r.json();
    showPreview();
  } catch (e) { st.innerHTML = '<span class="err">✖ ' + esc(e.message).slice(0, 500) + '</span>'; btn.disabled = false; }
}

function showPreview() {
  document.getElementById('modalBody').innerHTML = \`
    <h2>📝 รีวิวก่อนลงเว็บ <span style="font-size:13px;color:#94a3b8;font-weight:400">code \${draft.code} · \${draft.images.length} รูปบน R2 แล้ว</span></h2>
    <div class="imgs" style="grid-template-columns:repeat(auto-fill,minmax(84px,1fr))">\${draft.images.map((u,i) => \`<a href="\${u}" target="_blank" class="\${i===0?'cover':''}"><img src="\${u}"></a>\`).join('')}</div>
    <div class="f"><label>ชื่อสินค้า (SEO)</label><input type="text" id="pName" value="\${esc(draft.name)}"></div>
    <div class="f"><label>รายละเอียด</label><textarea id="pDesc">\${esc(draft.description)}</textarea></div>
    <div class="row">
      <div class="f"><label>ราคา</label><input type="number" id="pPrice" value="\${draft.price}"></div>
      <div class="f"><label>หมวดหมู่</label><select id="pCat">\${CATS.map(c => \`<option \${c === draft.categoryName ? 'selected' : ''}>\${esc(c)}</option>\`).join('')}</select></div>
      <div class="f"><label>สต็อก</label><input type="number" id="pStock" value="100"></div>
    </div>
    <div class="f"><label>Tags</label><input type="text" id="pTags" value="\${esc(draft.tags.join(', '))}"></div>
    <div class="hint">รายชื่อเพลง: \${draft.tracklist.length} เพลง · SKU: BT-\${draft.code}</div>
    <div class="login" id="loginBox" style="display:none">
      <b style="font-size:13px">เข้าสู่ระบบแอดมินก่อนลงเว็บ</b>
      <div class="row" style="margin-top:8px">
        <div class="f" style="margin:0"><input type="text" id="lEmail" placeholder="อีเมลแอดมิน"></div>
        <div class="f" style="margin:0"><input type="password" id="lPass" placeholder="รหัสผ่าน"></div>
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
      <button class="ghost" onclick="closeNew()">ปิด (ไว้ลงทีหลัง)</button>
      <button class="primary" id="pubBtn" onclick="publish(this)">✅ ยืนยันลงเว็บ btmusicdrive.com</button>
    </div>
    <div class="st" id="pStatus"></div>\`;
  fetch('/api/auth-status').then(r => r.json()).then(s => { if (!s.loggedIn) document.getElementById('loginBox').style.display = 'block'; });
}

/* ───────── QR: เก็บไฟล์ + สร้างคิวอาร์ ───────── */
async function openQr() {
  document.getElementById('overlay').classList.add('show');
  document.getElementById('modalBody').innerHTML = \`
    <h2>🔗 สร้าง QR Code <span style="font-size:13px;color:#94a3b8;font-weight:400">อัปไฟล์ขึ้น img.btmusicdrive.com แล้วได้ QR พร้อมพิมพ์ (1200px แปะโลโก้กลางได้)</span></h2>
    <div class="f"><label>ชื่อ (ใช้ตั้งชื่อไฟล์ QR เช่น คาราบาว-รายชื่อเพลง)</label><input type="text" id="qName" placeholder="คาราบาว-รายชื่อเพลง"></div>
    <div class="src"><input type="radio" name="qsrc" id="qsrcFile" value="file" checked>
      <label for="qsrcFile" style="display:inline">อัปไฟล์ PDF / รูป / .txt รายชื่อเพลง (เก็บขึ้น R2 ให้ แล้ว QR ชี้ไปที่ไฟล์นี้)</label>
      <input type="file" id="qFile" accept=".pdf,.txt,image/*" style="margin-top:8px" onchange="document.getElementById('qsrcFile').checked=true">
      <div class="hint">สแกนแล้วเปิดเต็มจอทันที ไม่ผ่านหน้า Google Drive · ถ้าเป็น .txt รายชื่อเพลง จะทำเป็นหน้าเว็บสวย ๆ มีช่องค้นหาเพลงให้เลย (เหมาะกับสินค้าที่เพลงเยอะจนใส่กระดาษไม่หมด)</div></div>
    <div class="src"><input type="radio" name="qsrc" id="qsrcUrl" value="url">
      <label for="qsrcUrl" style="display:inline">ใช้ลิงก์ที่มีอยู่แล้ว (เช่น หน้าสินค้า / ไลน์ร้าน)</label>
      <input type="text" id="qUrl" placeholder="https://btmusicdrive.com/product/…" style="width:100%;margin-top:8px;border:1px solid #d6d3ce;border-radius:8px;padding:8px" onfocus="document.getElementById('qsrcUrl').checked=true"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
      <button class="ghost" onclick="closeNew()">ปิด</button>
      <button class="primary" id="qGo" onclick="createQr(this)">สร้าง QR ✨</button>
    </div>
    <div class="st" id="qStatus"></div>
    <h3 style="margin-top:22px">📁 คลัง QR ที่เคยสร้าง</h3>
    <div id="qList" class="hint">กำลังโหลด…</div>\`;
  loadQrList();
}
async function loadQrList() {
  const items = await (await fetch('/api/qr-list')).json();
  document.getElementById('qList').innerHTML = items.length ? \`
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px">\${items.map(i => \`
      <div style="border:1px solid #e2ded8;border-radius:10px;padding:10px;text-align:center">
        <img src="/qr/\${encodeURIComponent(i.file)}" style="width:100%;border-radius:6px">
        <div style="font-size:12px;font-weight:600;margin:6px 0 2px">\${esc(i.name)}</div>
        <div style="font-size:10px;color:#94a3b8;word-break:break-all;line-height:1.3">\${esc(i.url.replace('https://',''))}</div>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:4px">
          <a href="\${i.url}" target="_blank" style="font-size:12px">📄 เปิดไฟล์</a>
          <a href="/qr/\${encodeURIComponent(i.file)}" download="\${esc(i.file)}" style="font-size:12px">⬇ QR</a>
        </div>
      </div>\`).join('')}</div>\` : 'ยังไม่มี — สร้างอันแรกได้เลย';
}
async function createQr(btn) {
  const st = document.getElementById('qStatus');
  const name = document.getElementById('qName').value.trim();
  if (!name) { st.innerHTML = '<span class="err">ใส่ชื่อก่อนครับ</span>'; return; }
  const useFile = document.getElementById('qsrcFile').checked;
  const body = { name };
  if (useFile) {
    const f = document.getElementById('qFile').files[0];
    if (!f) { st.innerHTML = '<span class="err">เลือกไฟล์ก่อนครับ</span>'; return; }
    st.innerHTML = '⏳ กำลังอ่านไฟล์…';
    body.file = { name: f.name, data: await fileToB64(f) };
  } else {
    body.url = document.getElementById('qUrl').value.trim();
    if (!/^https?:\\/\\//.test(body.url)) { st.innerHTML = '<span class="err">ใส่ลิงก์ให้ถูก (ขึ้นต้น https://)</span>'; return; }
  }
  btn.disabled = true;
  st.innerHTML = '⏳ ' + (useFile ? 'อัปไฟล์ขึ้น R2 + สร้าง QR…' : 'สร้าง QR…');
  try {
    const r = await fetch('/api/qr-create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    const out = await r.json();
    st.innerHTML = \`<span class="ok">✔ เสร็จแล้ว — ลิงก์: <a href="\${out.url}" target="_blank">\${out.url}</a></span>\`;
    loadQrList();
  } catch (e) { st.innerHTML = '<span class="err">✖ ' + esc(e.message).slice(0, 400) + '</span>'; }
  btn.disabled = false;
}

async function publish(btn) {
  const st = document.getElementById('pStatus');
  btn.disabled = true;
  try {
    const lb = document.getElementById('loginBox');
    if (lb.style.display !== 'none') {
      st.innerHTML = '⏳ กำลังเข้าสู่ระบบ…';
      const lr = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: document.getElementById('lEmail').value, password: document.getElementById('lPass').value }) });
      if (!lr.ok) throw new Error(await lr.text());
      lb.style.display = 'none';
    }
    st.innerHTML = '⏳ กำลังลงสินค้าบนเว็บ…';
    const r = await fetch('/api/publish', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: draft.code, name: document.getElementById('pName').value, description: document.getElementById('pDesc').value,
        price: +document.getElementById('pPrice').value, stock: +document.getElementById('pStock').value, categoryName: document.getElementById('pCat').value,
        tags: document.getElementById('pTags').value.split(',').map(s => s.trim()).filter(Boolean),
        capacity: draft.capacity, tracklist: draft.tracklist, images: draft.images }) });
    if (!r.ok) throw new Error(await r.text());
    const out = await r.json();
    st.innerHTML = \`<span class="ok">🎉 ลงเว็บสำเร็จ! <a href="\${out.url}" target="_blank">\${out.url}</a><br>
      อัปเดตไฟล์แพลตฟอร์มให้แล้ว — ปิดหน้าต่างนี้แล้วเลือกสินค้า code \${draft.code} เพื่อกดกระจาย Shopee / TikTok / Lazada ได้เลย</span>\`;
    load();
  } catch (e) { st.innerHTML = '<span class="err">✖ ' + esc(e.message).slice(0, 500) + '</span>'; btn.disabled = false; }
}
load();
</script></body></html>`;

// ── server ──
function readBody(req, limit = 120 * 1024 * 1024) {
  return new Promise((ok, no) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { no(new Error('ไฟล์ใหญ่เกินไป')); req.destroy(); } chunks.push(c); });
    req.on('end', () => ok(Buffer.concat(chunks)));
    req.on('error', no);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const json = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
  try {
    if (url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
    if (url.pathname === '/api/products') return json(200, loadProducts());
    if (url.pathname === '/api/meta') return json(200, { folders: nasFolders(), categories: CATEGORIES, nextCode: nextCode() });
    if (url.pathname === '/api/auth-status') return json(200, { loggedIn: !!ADMIN_TOKEN });

    if (url.pathname === '/api/login' && req.method === 'POST') {
      const { email, password } = JSON.parse(await readBody(req));
      const out = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (out.user?.role !== 'ADMIN') throw new Error('บัญชีนี้ไม่ใช่แอดมิน');
      ADMIN_TOKEN = out.token;
      console.log(`✔ login แอดมิน: ${out.user.email}`);
      return json(200, { ok: true });
    }

    if (url.pathname === '/api/new-product' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req));
      const shortName = String(b.name || '').trim().replace(/[\\/:*?"<>|]/g, '');
      if (!shortName) throw new Error('ไม่มีชื่อสินค้า');
      let code, folderName;

      if (b.folder) {   // ใช้โฟลเดอร์ NAS เดิม
        folderName = b.folder;
        const m = folderName.match(/^(\d+)/);
        code = m ? m[1].padStart(2, '0') : null;
        if (!code) throw new Error('ชื่อโฟลเดอร์ต้องขึ้นต้นด้วยเลข เช่น "57-ชื่อสินค้า"');
      } else {          // สร้างโฟลเดอร์ใหม่ + เซฟรูป
        if (!Array.isArray(b.images) || !b.images.length) throw new Error('ไม่มีรูป');
        code = nextCode();
        folderName = `${code}-${shortName}`;
        const dir = path.join(NAS_DIR, folderName);
        fs.mkdirSync(dir, { recursive: true });
        b.images.slice(0, 9).forEach((im, i) => {
          const ext = (im.name.match(/\.(jpe?g|png|webp|avif)$/i) || ['.jpg'])[0].toLowerCase();
          fs.writeFileSync(path.join(dir, `หลัก_${String(i + 1).padStart(2, '0')}${ext}`), Buffer.from(im.data, 'base64'));
        });
        console.log(`✔ สร้างโฟลเดอร์ NAS: ${folderName} (${Math.min(b.images.length, 9)} รูป)`);
      }
      // เก็บรายชื่อเพลงไว้คู่โฟลเดอร์
      if (Array.isArray(b.tracklist) && b.tracklist.length) {
        try { fs.writeFileSync(path.join(NAS_DIR, folderName, 'รายชื่อเพลง.txt'), b.tracklist.join('\r\n'), 'utf8'); } catch { }
      }

      console.log('⏳ แปลงรูป + อัปขึ้น R2…');
      runScript('build-marketplace-images.js', ['--apply']);
      runScript('upload-r2.js', ['--apply']);

      const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'marketplace-images', 'catalog.json'), 'utf8')).products
        .find(p => p.code === code);
      if (!cat) throw new Error(`แปลงรูปแล้วแต่ไม่พบ code ${code} ใน catalog — เช็คชื่อโฟลเดอร์`);

      const songs = (b.tracklist || []).length || null;
      const seo = buildSeoDraft({ shortName, songs, capacity: b.capacity || '4GB', price: b.price || 279 });
      console.log(`✔ SEO draft พร้อม: ${seo.name}`);
      return json(200, { code, capacity: b.capacity || '4GB', price: b.price || 279, images: cat.images, tracklist: b.tracklist || [], ...seo });
    }

    if (url.pathname === '/api/publish' && req.method === 'POST') {
      if (!ADMIN_TOKEN) throw new Error('ยังไม่ได้เข้าสู่ระบบแอดมิน');
      const b = JSON.parse(await readBody(req));
      const product = await api('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: b.name, price: b.price, stock: b.stock ?? 100, categoryName: b.categoryName,
          imageUrl: b.images[0], images: b.images, brand: 'btmusicdrive', sku: `BT-${b.code}`,
          tags: b.tags, tracklist: b.tracklist, specs: { capacity: b.capacity }, description: b.description,
        }),
      });
      console.log(`🎉 ลงเว็บสำเร็จ: ${product.name} (slug: ${product.slug})`);

      // sync products.json (fallback) + สร้าง listings ใหม่ให้รวมตัวใหม่ — พลาดได้ไม่ถือว่า fail
      try { runScript('sync-products-json.js', []); console.log('✔ sync products.json'); }
      catch { console.warn('⚠ sync products.json ไม่สำเร็จ (ต้องมี DATABASE_URL) — รัน node scripts/sync-products-json.js เองทีหลัง'); }
      try { runScript('generate-marketplace-listings.js', ['--apply']); console.log('✔ อัปเดต marketplace-listings.xlsx'); } catch { }

      return json(200, { ok: true, slug: product.slug, url: `https://btmusicdrive.com/product/${product.slug}` });
    }

    if (url.pathname === '/api/qr-list') return json(200, loadQrReg());

    if (url.pathname.startsWith('/qr/')) {
      const f = path.join(QR_DIR, path.basename(decodeURIComponent(url.pathname)));
      if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'content-type': 'image/png' });
      return res.end(fs.readFileSync(f));
    }

    if (url.pathname === '/api/qr-create' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req));
      let target = b.url;
      if (b.file) {
        // เก็บไฟล์ต้นฉบับไว้ใน marketplace-docs/ แล้วอัปขึ้น R2 → QR ชี้ไปที่ไฟล์บน R2
        const ext = (b.file.name.match(/\.[a-z0-9]+$/i) || ['.pdf'])[0].toLowerCase();
        const safe = String(b.name).trim().replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 60);
        const docsDir = path.join(ROOT, 'marketplace-docs');
        fs.mkdirSync(docsDir, { recursive: true });
        const local = path.join(docsDir, safe + ext);
        fs.writeFileSync(local, Buffer.from(b.file.data, 'base64'));
        console.log(`✔ เก็บไฟล์: marketplace-docs/${safe}${ext}`);
        if (ext === '.txt') {
          // .txt รายชื่อเพลง → สร้างหน้าเว็บสวย ๆ ให้ลูกค้าสแกนดู (ค้นหาเพลงได้)
          const htmlLocal = path.join(docsDir, safe + '.html');
          fs.writeFileSync(htmlLocal, tracklistHtml(b.name, Buffer.from(b.file.data, 'base64').toString('utf8')), 'utf8');
          target = uploadToR2(htmlLocal, `docs/${safe}.html`);
          console.log(`✔ สร้างหน้ารายชื่อเพลง + R2: ${target}`);
        } else {
          target = uploadToR2(local, `docs/${safe}${ext}`);
          console.log(`✔ R2: ${target}`);
        }
      }
      if (!/^https?:\/\//.test(String(target || ''))) throw new Error('ไม่มีลิงก์หรือไฟล์');
      const item = await makeQr({ name: b.name, url: target });
      console.log(`✔ QR: qr/${item.file} → ${target}`);
      return json(200, item);
    }

    if (url.pathname === '/api/generate') {
      const file = genFile(url.searchParams.get('platform'), url.searchParams.get('code'));
      res.writeHead(200, {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'x-filename': path.basename(file),
        'content-disposition': `attachment; filename="${path.basename(file)}"`,
      });
      console.log(`✔ ${url.searchParams.get('platform')} code ${url.searchParams.get('code')} → ${path.basename(file)}`);
      return res.end(fs.readFileSync(file));
    }
    res.writeHead(404); res.end('not found');
  } catch (e) {
    const msg = (e.stderr ? String(e.stderr) : '') || e.message;
    console.error('✖', msg);
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(msg);
  }
}).listen(PORT, () => {
  console.log(`🎛 Listing Studio เปิดแล้ว → http://localhost:${PORT}`);
  console.log(`   API เว็บ: ${API_BASE} · NAS: ${NAS_DIR}`);
  console.log('   ➕ ลงสินค้าใหม่ = ลงเว็บก่อน → ค่อยกดกระจายแพลตฟอร์ม (Ctrl+C เพื่อปิด)');
});
