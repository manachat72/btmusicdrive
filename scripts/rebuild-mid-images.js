/**
 * สร้าง "รูปกลาง" jpg ชุดใหม่ให้ตรงกับรูปที่แสดงบนเว็บตอนนี้ แล้วอัปขึ้น R2 `mid/<slug>/`
 *
 *   node scripts/rebuild-mid-images.js                 # dry-run — บอกว่าจะทำอะไรบ้าง
 *   node scripts/rebuild-mid-images.js --apply         # สร้างไฟล์ + อัป R2 จริง
 *   node scripts/rebuild-mid-images.js --apply --slug <slug>   # เฉพาะตัวเดียว
 *
 * ทำไมต้องมีชุดใหม่: คลังกลางเดิม `products/<code>/` ผูกกับ code marketplace ชุดเก่า
 * ซึ่งหลังเปลี่ยนเลขโฟลเดอร์ NAS แล้วไม่ตรงกับสินค้าจริงอีกต่อไป (ตรงแค่ 14/54)
 * ชุดใหม่ตั้งชื่อด้วย slug เหมือนโฟลเดอร์รูปเว็บ — ชนกันไม่ได้ และไม่ทับของเดิมที่ xlsx เก่าใช้อยู่
 *
 * ลำดับรูป = ลำดับใน DB (products.json) = ที่เห็นบนหน้าเว็บ
 * ต้นทางแต่ละใบ: หาไฟล์ต้นฉบับในโฟลเดอร์ NAS ของสินค้า (เลขชุดจาก SKU) ที่ dHash ตรงกับรูปเว็บ
 * ถ้าไม่เจอ (เช่นรูปที่ทำขึ้นใหม่ ไม่มีบน NAS) ใช้ไฟล์ webp ของเว็บแทน
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const r2 = require('./lib/r2');
const { toMid, MAX_IMAGES } = require('./lib/product-images');
const { imageSlugFromUrl } = require('./lib/product-image-path');
const { byNaturalName } = require('./lib/web-images');
const { parseSku } = require('./lib/sku');
const { nasDir } = require('./lib/nas');

const ROOT = path.join(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const ONLY = (process.argv.includes('--slug') ? process.argv[process.argv.indexOf('--slug') + 1] : '') || '';
const OUT_DIR = path.join(ROOT, 'marketplace-images', 'mid');     // marketplace-images/ อยู่ใน .gitignore
const REPORT = path.join(ROOT, 'reports', 'mid-images.json');
const CACHE_FILE = path.join(ROOT, 'reports', '.sku-hash-cache.json');
const PREFIX = 'mid';
const HASH_MAX = 10;

// --- .env.r2 (gitignored) ---
for (const line of (fs.existsSync(path.join(ROOT, '.env.r2')) ? fs.readFileSync(path.join(ROOT, '.env.r2'), 'utf8') : '').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}

const cache = (() => { try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { return {}; } })();
let cacheDirty = false;

async function dhash(file) {
  let st; try { st = fs.statSync(file); } catch { return null; }
  const key = `${file}|${st.size}|${Math.round(st.mtimeMs)}`;
  if (cache[key]) return cache[key];
  try {
    const { data } = await sharp(file, { failOn: 'none' }).resize(9, 8, { fit: 'fill' }).grayscale().raw().toBuffer({ resolveWithObject: true });
    let bits = '';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += data[y * 9 + x] < data[y * 9 + x + 1] ? '1' : '0';
    cache[key] = bits; cacheDirty = true;
    return bits;
  } catch { return null; }
}
const hamming = (a, b) => { let d = 0; for (let i = 0; i < 64; i++) if (a[i] !== b[i]) d++; return d; };

const listImages = dir => {
  try {
    return fs.readdirSync(dir).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort(byNaturalName).map(f => path.join(dir, f));
  } catch { return []; }
};

/** โฟลเดอร์ NAS ของสินค้าจากเลขชุดใน SKU */
function nasFolderOf(no) {
  if (!no) return '';
  try {
    const hit = fs.readdirSync(nasDir(), { withFileTypes: true })
      .filter(e => e.isDirectory() && parseInt(e.name, 10) === no)
      .sort((a, b) => a.name.length - b.name.length)[0];      // "29-…" มาก่อน "29.1-…"
    return hit ? path.join(nasDir(), hit.name) : '';
  } catch { return ''; }
}

/** รูปเว็บในเครื่อง เรียงตามลำดับที่ DB เก็บไว้ (= ที่เห็นบนหน้าเว็บ) */
function webFilesInDbOrder(slug, urls) {
  const dir = path.join(ROOT, 'images', 'products', slug);
  const local = new Map();
  for (const f of listImages(dir).filter(f => /\.webp$/i.test(f))) {
    const n = parseInt((path.basename(f).match(/-(\d+)\.webp$/i) || [])[1] || '', 10);
    if (Number.isFinite(n)) local.set(n, f);
  }
  const out = [];
  for (const u of urls) {
    const n = parseInt((String(u).match(/-(\d+)(?:-[0-9a-f]{6,})?\.(?:webp|avif)$/i) || [])[1] || '', 10);
    const f = local.get(n);
    if (f && !out.includes(f)) out.push(f);
  }
  // เผื่อ URL แปลก ๆ จน map ไม่ได้ — เติมไฟล์ที่เหลือตามลำดับชื่อ
  for (const f of local.size ? [...local.entries()].sort((a, b) => a[0] - b[0]).map(x => x[1]) : []) {
    if (!out.includes(f)) out.push(f);
  }
  return out.slice(0, MAX_IMAGES);
}

(async () => {
  const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));
  const list = (Array.isArray(products) ? products : products.products || []).filter(p => !ONLY || p.slug === ONLY);
  const report = {};
  let nFromNas = 0, nFromWeb = 0, nUploaded = 0;

  for (const p of list) {
    const slug = imageSlugFromUrl(p.imageUrl) || imageSlugFromUrl((p.images || [])[0]);
    if (!slug) { console.log(`⚠ ${p.sku} ไม่รู้โฟลเดอร์รูปเว็บ — ข้าม`); continue; }

    const webFiles = webFilesInDbOrder(slug, [p.imageUrl, ...(p.images || [])]);
    if (!webFiles.length) { console.log(`⚠ ${p.sku} ไม่พบรูปเว็บในเครื่อง (images/products/${slug}/) — ข้าม`); continue; }

    // ต้นฉบับความละเอียดสูงใน NAS
    const no = parseSku(p.sku)?.no;
    const nasFolder = nasFolderOf(no);
    const nasFiles = listImages(nasFolder);
    const nasHashes = [];
    for (const f of nasFiles) { const h = await dhash(f); if (h) nasHashes.push({ f, h }); }

    const items = [];
    let fromNas = 0;
    for (let i = 0; i < webFiles.length; i++) {
      const wh = await dhash(webFiles[i]);
      let src = webFiles[i], via = 'เว็บ';
      if (wh && nasHashes.length) {
        let best = null;
        for (const c of nasHashes) { const d = hamming(wh, c.h); if (!best || d < best.d) best = { d, f: c.f }; }
        if (best && best.d <= HASH_MAX) { src = best.f; via = 'NAS'; fromNas++; }
      }
      items.push({ src, via, name: `${slug}-${String(i + 1).padStart(2, '0')}.jpg` });
    }
    nFromNas += fromNas; nFromWeb += items.length - fromNas;

    const urls = items.map(it => `${r2.CDN}/${PREFIX}/${slug}/${it.name}`);
    report[p.sku] = { slug, no: no || null, images: urls, fromNas, total: items.length };
    console.log(`${(p.sku || '-').padEnd(15)} ${String(items.length).padStart(2)} ใบ · ต้นฉบับ NAS ${fromNas}/${items.length}${nasFolder ? '' : ' (ไม่เจอโฟลเดอร์ NAS)'}  ${slug}`);

    if (!APPLY) continue;

    const outDir = path.join(OUT_DIR, slug);
    fs.mkdirSync(outDir, { recursive: true });
    const uploads = [];
    for (const it of items) {
      const buf = await toMid(fs.readFileSync(it.src));
      fs.writeFileSync(path.join(outDir, it.name), buf);
      uploads.push({ key: `${PREFIX}/${slug}/${it.name}`, body: buf });
    }
    await r2.putMany(uploads);
    nUploaded += uploads.length;
  }

  if (cacheDirty) { fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true }); fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)); }
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8');

  console.log(`\n${APPLY ? `✔ อัป R2 ${nUploaded} ไฟล์ → ${r2.CDN}/${PREFIX}/<slug>/` : '(dry-run — ยังไม่สร้างไฟล์/ไม่อัป R2)'}`);
  console.log(`   สินค้า ${Object.keys(report).length} ตัว · รูปจากต้นฉบับ NAS ${nFromNas} ใบ · จากรูปเว็บ ${nFromWeb} ใบ`);
  console.log(`📄 รายการลิงก์: reports/mid-images.json`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
