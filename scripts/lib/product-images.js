/**
 * ท่อรูปสินค้า 3 ชั้น — ทำงานได้ทั้งเมื่อ NAS ต่ออยู่และไม่ต่อ
 *
 *   1. ต้นฉบับ   R2 originals/<code>-<slug>/<code>-orig-01.jpg   ไฟล์ดิบ ไม่ย่อ ไม่บีบ
 *                (+ NAS Z:\photos\รูปสินค้า\<code>-<ชื่อ>\ ถ้าไดรฟ์ต่ออยู่)
 *   2. รูปกลาง   R2 products/<code>/<code>-01.jpg               1200x1200 JPEG q88
 *                → ลิงก์ชุดนี้คือตัวที่ xlsx ทุกแพลตฟอร์มใช้
 *   3. รูปเว็บ   images/products/<slug>/<slug>-1.webp + .avif   ≤800px (web-images.js)
 *
 * ต้นฉบับบน R2 คือประกันว่าทำรูปใหม่ได้ตลอด แม้ NAS พังหรือไม่ได้ต่อ
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const r2 = require('./r2');
const webImg = require('./web-images');

const ROOT = path.resolve(__dirname, '..', '..');
const MKT_DIR = path.join(ROOT, 'marketplace-images');
const MKT_PRODUCTS = path.join(MKT_DIR, 'products');
const CATALOG = path.join(MKT_DIR, 'catalog.json');

const MID_SIZE = 1200;      // คงขนาดเดิม — ลิงก์ในเทมเพลตแพลตฟอร์มทุกเจ้าใช้ชุดนี้อยู่
const MID_QUALITY = 88;
const MAX_IMAGES = 9;       // Shopee/TikTok รับ 9 · Lazada 8
const IMG_EXT = /\.(jpe?g|png|webp|avif|tiff?|bmp)$/i;

/** อ่านต้นฉบับจากโฟลเดอร์ (NAS) เรียงตามเลขท้ายชื่อ */
function readSourceDir(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(f => f.isFile() && IMG_EXT.test(f.name))
    .map(f => f.name)
    .sort((a, b) => {
      const na = parseInt((a.match(/(\d+)(?=\.[^.]+$)/) || [])[1] || '0', 10);
      const nb = parseInt((b.match(/(\d+)(?=\.[^.]+$)/) || [])[1] || '0', 10);
      return na - nb || a.localeCompare(b);
    })
    .slice(0, MAX_IMAGES)
    .map(name => ({ name, body: fs.readFileSync(path.join(dir, name)) }));
}

function loadCatalog() {
  try { return JSON.parse(fs.readFileSync(CATALOG, 'utf8')); }
  catch { return { cdnBase: r2.CDN, generatedAt: null, products: [] }; }
}

/** เขียน catalog.json ใหม่โดยแทนที่/เพิ่มสินค้า code นี้ (เรียงตาม code) */
function upsertCatalog(entry) {
  const cat = loadCatalog();
  cat.products = cat.products.filter(p => p.code !== entry.code).concat([entry])
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  cat.cdnBase = r2.CDN;
  cat.generatedAt = new Date().toISOString();
  fs.mkdirSync(MKT_DIR, { recursive: true });
  fs.writeFileSync(CATALOG, JSON.stringify(cat, null, 2), 'utf8');
  return cat;
}

/** แปลงเป็นรูปกลาง 1200x1200 (pad ขาวถ้าไม่จัตุรัส) — สเปกเดียวกับ build-marketplace-images.js */
async function toMid(buf) {
  return sharp(buf)
    .rotate()
    .resize({ width: MID_SIZE, height: MID_SIZE, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 }, withoutEnlargement: false })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: MID_QUALITY, progressive: true, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

/**
 * ทำรูปครบ 3 ชั้นจากต้นฉบับชุดเดียว
 * @param {object} o
 * @param {string} o.code        เลขสินค้า 2 หลัก เช่น "57"
 * @param {string} o.slug        slug SEO (ใช้ตั้งชื่อโฟลเดอร์รูปเว็บ + originals)
 * @param {string} o.title       ชื่อที่เก็บใน catalog
 * @param {string} [o.srcDir]    โฟลเดอร์ต้นฉบับบน NAS
 * @param {{name:string,body:Buffer}[]} [o.sources] หรือส่งไฟล์มาตรง ๆ (อัปโหลดผ่านเว็บ)
 * @param {string} [o.dirName]   ชื่อโฟลเดอร์ NAS (เก็บใน catalog)
 * @param {(m:string)=>void} [o.log]
 */
async function processProductImages({ code, slug, title, srcDir, sources, dirName, log = () => { } }) {
  code = String(code).padStart(2, '0');
  let files = sources && sources.length ? sources.slice(0, MAX_IMAGES) : null;
  if (!files && srcDir && fs.existsSync(srcDir)) files = readSourceDir(srcDir);
  if (!files || !files.length) throw new Error('ไม่พบไฟล์ต้นฉบับ (ทั้งจาก NAS และจากที่อัปโหลด)');

  // ── 1. ต้นฉบับขึ้น R2 (ไม่แตะ ไม่ย่อ ไม่บีบ) ──
  const origPrefix = `originals/${code}-${slug}`;
  const origItems = files.map((f, i) => {
    const ext = (path.extname(f.name) || '.jpg').toLowerCase();
    return { key: `${origPrefix}/${code}-orig-${String(i + 1).padStart(2, '0')}${ext}`, body: f.body, cacheControl: 'public, max-age=31536000, immutable' };
  });
  const origBytes = origItems.reduce((n, o) => n + o.body.length, 0);
  const origs = await r2.putMany(origItems);
  log(`✔ ต้นฉบับขึ้น R2 ${origs.length} ไฟล์ (${(origBytes / 1024 / 1024).toFixed(1)} MB) → ${origPrefix}/`);

  // ── 2. รูปกลาง 1200 → เก็บในเครื่อง + ขึ้น R2 (ลิงก์สำหรับ xlsx) ──
  const outDir = path.join(MKT_PRODUCTS, code);
  fs.mkdirSync(outDir, { recursive: true });
  const midItems = [];
  for (let i = 0; i < files.length; i++) {
    const name = `${code}-${String(i + 1).padStart(2, '0')}.jpg`;
    const body = await toMid(files[i].body);
    fs.writeFileSync(path.join(outDir, name), body);
    midItems.push({ key: `products/${code}/${name}`, body });
  }
  const mids = await r2.putMany(midItems);
  const midUrls = mids.map(m => m.url);
  log(`✔ รูปกลาง 1200×1200 ${midUrls.length} ใบขึ้น R2 → products/${code}/`);

  upsertCatalog({ code, title: title || dirName || code, dirName: dirName || `${code}-${title || ''}`.trim(), count: midUrls.length, images: midUrls });

  // ── 3. รูปเว็บ ≤800 webp+avif ชื่อ SEO ──
  const web = await webImg.buildWebImages({ buffers: files.map(f => f.body), slug });
  log(`✔ รูปเว็บ ${web.urls.length} ใบ (${(web.bytes / 1024).toFixed(0)} KB) → images/products/${slug}/`);

  return {
    originals: origs.map(o => o.url),
    mid: midUrls,
    web: web.urls,
    code, slug,
  };
}

/** ดึงต้นฉบับกลับจาก R2 (ใช้ตอน NAS ไม่ได้ต่อแต่อยากทำรูปใหม่) */
async function fetchOriginals(code, slug) {
  const keys = await r2.listKeys(`originals/${code}-${slug}/`);
  const out = [];
  for (const k of keys.sort((a, b) => a.key.localeCompare(b.key))) {
    const res = await fetch(r2.urlOf(k.key));
    if (!res.ok) continue;
    out.push({ name: path.basename(k.key), body: Buffer.from(await res.arrayBuffer()) });
  }
  return out;
}

module.exports = { processProductImages, fetchOriginals, loadCatalog, upsertCatalog, MID_SIZE, MAX_IMAGES };
