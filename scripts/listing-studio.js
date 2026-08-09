#!/usr/bin/env node
/**
 * 🎛 Listing Studio — หน้าเว็บหลังบ้าน (local) สำหรับลงสินค้าทีละชิ้น
 *
 * เปิดหน้าเว็บบนเครื่อง: เลือกสินค้า → เห็นรูปทั้งหมด → กดปุ่มสร้าง template.xlsx
 * ของแต่ละแพลตฟอร์ม (Shopee / Lazada / TikTok Shop) แล้วดาวน์โหลดไปอัปโหลดเอง
 *
 * ข้อมูล: marketplace-images/catalog.json + templates/marketplace-listings.xlsx
 * Shopee/TikTok ใช้เทมเพลตทางการ (หาใน Downloads) ผ่าน fill-*-template.js --code
 * Lazada ยังไม่มีเทมเพลตทางการ → สร้าง xlsx ข้อมูลครบให้ copy ลงเทมเพลต
 *
 * Usage: npm run mkt:studio   → เปิด http://localhost:4777
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'templates');
const PORT = 4777;

// ── โหลดข้อมูลสินค้า (โหลดใหม่ทุก request จะได้ไม่ต้อง restart เวลาข้อมูลเปลี่ยน) ──
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
  return catalog.map(p => ({
    code: p.code, title: p.title, images: p.images, count: p.images.length,
    ...(meta[p.code] || {}),
  }));
}

function genFile(platform, code) {
  code = String(code).padStart(2, '0');
  const node = process.execPath;
  if (platform === 'shopee') {
    execFileSync(node, [path.join(__dirname, 'fill-shopee-template.js'), '--apply', '--code', code], { cwd: ROOT, stdio: 'pipe' });
    return path.join(OUT_DIR, `shopee-upload-${code}.xlsx`);
  }
  if (platform === 'tiktok') {
    execFileSync(node, [path.join(__dirname, 'fill-tiktok-template.js'), '--apply', '--code', code], { cwd: ROOT, stdio: 'pipe' });
    return path.join(OUT_DIR, `tiktok-upload-${code}.xlsx`);
  }
  if (platform === 'lazada') {
    // Lazada: สร้าง xlsx ข้อมูลครบ 1 รายการจากชีต Lazada (ยังไม่มีเทมเพลตทางการให้เติม)
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

// ── หน้าเว็บ ──
const PAGE = /* html */ `<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Listing Studio — btmusicdrive</title>
<style>
  :root { --primary:#8B7355; --dark:#0F172A; --gold:#f5c343; }
  * { box-sizing:border-box; margin:0; }
  body { font-family:'Segoe UI',Tahoma,sans-serif; background:#f6f4f1; color:#1e293b; }
  header { background:var(--dark); color:#fff; padding:14px 22px; display:flex; align-items:center; gap:12px; position:sticky; top:0; z-index:5; }
  header h1 { font-size:18px; font-weight:600; }
  header .badge { background:var(--primary); border-radius:99px; padding:2px 12px; font-size:12px; }
  header input { margin-left:auto; border:0; border-radius:8px; padding:8px 14px; width:min(340px,40vw); font-size:14px; }
  main { display:grid; grid-template-columns:minmax(300px,380px) 1fr; gap:0; height:calc(100vh - 56px); }
  #list { overflow-y:auto; border-right:1px solid #e2ded8; background:#fff; }
  .item { display:flex; gap:10px; padding:10px 14px; cursor:pointer; border-bottom:1px solid #f1eee9; align-items:center; }
  .item:hover { background:#faf7f2; } .item.active { background:#f3ecdf; border-left:4px solid var(--primary); padding-left:10px; }
  .item img { width:52px; height:52px; object-fit:cover; border-radius:8px; background:#eee; flex:none; }
  .item .t { font-size:13px; line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .item .m { font-size:11px; color:#94a3b8; margin-top:2px; }
  #detail { overflow-y:auto; padding:22px 26px; }
  #detail .empty { color:#94a3b8; text-align:center; margin-top:18vh; font-size:15px; }
  h2 { font-size:17px; line-height:1.4; margin-bottom:4px; }
  .meta { color:#64748b; font-size:13px; margin-bottom:14px; }
  .meta b { color:var(--primary); }
  .warn { background:#fef3c7; border:1px solid #fcd34d; color:#92400e; border-radius:8px; padding:8px 12px; font-size:13px; margin-bottom:14px; display:inline-block; }
  .imgs { display:grid; grid-template-columns:repeat(auto-fill,minmax(110px,1fr)); gap:10px; margin-bottom:22px; }
  .imgs a { position:relative; display:block; }
  .imgs img { width:100%; aspect-ratio:1; object-fit:cover; border-radius:10px; border:1px solid #e2ded8; background:#eee; }
  .imgs .cover::after { content:'ภาพปก'; position:absolute; top:6px; left:6px; background:var(--dark); color:#fff; font-size:10px; padding:2px 8px; border-radius:99px; }
  h3 { font-size:14px; color:#475569; margin:18px 0 10px; }
  .btns { display:flex; flex-wrap:wrap; gap:12px; }
  .btn { border:0; border-radius:12px; padding:14px 22px; font-size:15px; font-weight:600; cursor:pointer; color:#fff; display:flex; align-items:center; gap:8px; box-shadow:0 2px 6px rgb(15 23 42 / .12); transition:transform .1s; }
  .btn:hover { transform:translateY(-2px); } .btn:disabled { opacity:.55; cursor:wait; transform:none; }
  .btn small { font-weight:400; opacity:.85; font-size:11px; display:block; text-align:left; }
  .shopee { background:#ee4d2d; } .lazada { background:#0f146d; } .tiktok { background:#000; }
  #status { margin-top:14px; font-size:13px; color:#475569; min-height:20px; white-space:pre-wrap; }
  #status .ok { color:#15803d; } #status .err { color:#b91c1c; }
  @media (max-width:760px){ main{grid-template-columns:1fr;} #detail{display:none;} #detail.show{display:block;} #list.hide{display:none;} }
</style></head><body>
<header>
  <h1>🎛 Listing Studio</h1><span class="badge">btmusicdrive หลังบ้าน</span>
  <input id="q" placeholder="ค้นหาสินค้า… (ชื่อ / code)" autocomplete="off">
</header>
<main>
  <div id="list"></div>
  <div id="detail"><div class="empty">← เลือกสินค้าจากรายการซ้ายมือ<br>แล้วกดปุ่มสร้างไฟล์ลงสินค้าของแพลตฟอร์มที่ต้องการ</div></div>
</main>
<script>
let PRODUCTS = [], current = null;

async function load() {
  PRODUCTS = await (await fetch('/api/products')).json();
  render(PRODUCTS);
}
function render(items) {
  const el = document.getElementById('list');
  el.innerHTML = items.map(p => \`
    <div class="item" data-code="\${p.code}" onclick="pick('\${p.code}')">
      <img loading="lazy" src="\${p.images[0] || ''}" alt="">
      <div><div class="t">\${esc(p.title)}</div>
      <div class="m">code \${p.code} · \${p.count} รูป · ฿\${p.price ?? '-'}\${p.note ? ' · ⚠' : ''}</div></div>
    </div>\`).join('');
}
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function pick(code) {
  current = PRODUCTS.find(p => p.code === code);
  document.querySelectorAll('.item').forEach(i => i.classList.toggle('active', i.dataset.code === code));
  const d = document.getElementById('detail');
  d.classList.add('show'); document.getElementById('list').classList.remove('hide');
  d.innerHTML = \`
    <h2>\${esc(current.title)}</h2>
    <div class="meta">code <b>\${current.code}</b> · SKU \${esc(current.sku ?? '-')} · ราคา <b>฿\${current.price ?? '-'}</b> · สต็อก \${current.stock ?? '-'} · รูป \${current.count}</div>
    \${current.note ? '<div class="warn">⚠ ' + esc(current.note) + '</div>' : ''}
    <div class="imgs">\${current.images.map((u,i) => \`<a href="\${u}" target="_blank" class="\${i===0?'cover':''}"><img loading="lazy" src="\${u}"></a>\`).join('')}</div>
    <h3>สร้างไฟล์ลงสินค้า (1 ชิ้น) — กดแล้วได้ .xlsx ไปอัปโหลดที่ Seller Center ของแต่ละเจ้า</h3>
    <div class="btns">
      <button class="btn shopee" onclick="gen(this,'shopee')">🟠 Shopee<small>เทมเพลตทางการ พร้อมอัป</small></button>
      <button class="btn tiktok" onclick="gen(this,'tiktok')">⬛ TikTok Shop<small>เทมเพลตทางการ พร้อมอัป</small></button>
      <button class="btn lazada" onclick="gen(this,'lazada')">🔵 Lazada<small>ข้อมูลครบ copy ลงเทมเพลต</small></button>
    </div>
    <div id="status"></div>\`;
  window.scrollTo(0,0);
}
async function gen(btn, platform) {
  const st = document.getElementById('status');
  btn.disabled = true;
  st.innerHTML = '⏳ กำลังสร้างไฟล์ ' + platform + '…';
  try {
    const r = await fetch('/api/generate?platform=' + platform + '&code=' + current.code);
    if (!r.ok) throw new Error(await r.text());
    const blob = await r.blob();
    const name = r.headers.get('x-filename') || (platform + '-' + current.code + '.xlsx');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
    a.click(); URL.revokeObjectURL(a.href);
    st.innerHTML = '<span class="ok">✔ ดาวน์โหลด ' + name + ' แล้ว — เอาไปอัปโหลดที่ Seller Center ได้เลย</span>';
  } catch (e) {
    st.innerHTML = '<span class="err">✖ ' + esc(e.message).slice(0, 400) + '</span>';
  }
  btn.disabled = false;
}
document.getElementById('q').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  render(PRODUCTS.filter(p => p.title.toLowerCase().includes(q) || p.code.includes(q)));
});
load();
</script></body></html>`;

// ── server ──
http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(PAGE);
    }
    if (url.pathname === '/api/products') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(loadProducts()));
    }
    if (url.pathname === '/api/generate') {
      const file = genFile(url.searchParams.get('platform'), url.searchParams.get('code'));
      const buf = fs.readFileSync(file);
      res.writeHead(200, {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'x-filename': path.basename(file),
        'content-disposition': `attachment; filename="${path.basename(file)}"`,
      });
      console.log(`✔ ${new Date().toLocaleTimeString()}  ${url.searchParams.get('platform')} code ${url.searchParams.get('code')} → ${path.basename(file)}`);
      return res.end(buf);
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
  console.log('   เลือกสินค้า → กดปุ่มแพลตฟอร์ม → ได้ไฟล์ .xlsx ไปอัปโหลดเอง (Ctrl+C เพื่อปิด)');
});
