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

/** อ่านต้นฉบับจากโฟลเดอร์ (NAS) เรียงชื่อแบบเดียวกับที่เห็นใน Explorer */
function readSourceDir(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(f => f.isFile() && IMG_EXT.test(f.name))
    .map(f => f.name)
    .sort(webImg.byNaturalName)
    .slice(0, MAX_IMAGES)
    .map(name => ({ name, body: fs.readFileSync(path.join(dir, name)) }));
}

function loadCatalog() {
  try { return JSON.parse(fs.readFileSync(CATALOG, 'utf8')); }
  catch { return { cdnBase: r2.CDN, generatedAt: null, products: [] }; }
}

/**
 * เขียน catalog.json ใหม่โดย merge ทับสินค้า code นี้ (เรียงตาม code)
 * merge ไม่ใช่ replace — field ที่ไม่ได้ส่งมา (undefined) ต้องคงของเดิมไว้
 * ไม่งั้นเรียกด้วย title/dirName ว่าง ชื่อสินค้าเดิมใน catalog จะหายหรือถูกเขียนทับด้วยชื่อสินค้าตัวอื่น
 */
function upsertCatalog(entry) {
  const cat = loadCatalog();
  const prev = cat.products.find(p => p.code === entry.code) || {};
  const clean = Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  cat.products = cat.products.filter(p => p.code !== entry.code).concat([{ ...prev, ...clean }])
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
 * ลบไฟล์ใต้ prefix ที่ไม่ได้อยู่ในชุดที่เพิ่งอัปไป
 * จำเป็นเมื่อจำนวนรูปลดลง (ลบรูปทิ้ง) — ถ้าไม่ลบ orig-05 ที่ค้างจะถูก fetchOriginals
 * ดึงกลับมาในรอบถัดไป รูปที่ลบไปแล้วก็โผล่กลับมาเอง
 */
async function pruneR2(prefix, keepKeys, log = () => { }) {
  try {
    const keep = new Set(keepKeys);
    const stale = (await r2.listKeys(prefix)).filter(k => !keep.has(k.key));
    if (!stale.length) return 0;
    await r2.deleteKeys(stale);
    log(`✔ ลบไฟล์ค้างบน R2 ${stale.length} ไฟล์ → ${prefix}`);
    return stale.length;
  } catch (e) {
    log(`⚠ ลบไฟล์ค้างบน R2 ไม่สำเร็จ (${prefix}): ${String(e.message).slice(0, 120)}`);
    return 0;
  }
}

/**
 * ทำรูปครบ 3 ชั้นจากต้นฉบับชุดเดียว
 * @param {object} o
 * @param {string} o.code        เลขสินค้า 2 หลัก เช่น "57"
 * @param {string} o.slug        slug SEO (ใช้ตั้งชื่อโฟลเดอร์รูปเว็บ + originals)
 * @param {string} o.title       ชื่อที่เก็บใน catalog (ต้องเป็นชื่อของสินค้า code นี้เท่านั้น)
 * @param {string} [o.srcDir]    โฟลเดอร์ต้นฉบับบน NAS
 * @param {{name:string,body:Buffer}[]} [o.sources] หรือส่งไฟล์มาตรง ๆ (อัปโหลดผ่านเว็บ)
 * @param {string} [o.dirName]   ชื่อโฟลเดอร์ NAS (เก็บใน catalog)
 * @param {boolean} [o.prune]    ลบไฟล์ค้างบน R2 ที่เกินชุดใหม่ (default true)
 *   ส่ง false เมื่อ "ไม่มั่นใจว่า sources คือชุดเต็ม" — เช่นกู้รูปจากที่อื่นมาบางส่วน
 *   ถ้า prune ทั้งที่ชุดไม่ครบ รูปกลาง products/<code>/ จะถูกลบ = ลิงก์ในลิสต์ Shopee/TikTok/Lazada พังหมด
 * @param {(m:string)=>void} [o.log]
 */
async function processProductImages({ code, slug, title, srcDir, sources, dirName, prune = true, log = () => { } }) {
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
  if (prune) await pruneR2(`${origPrefix}/`, origItems.map(o => o.key), log);

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
  if (prune) {
    await pruneR2(`products/${code}/`, midItems.map(m => m.key), log);
    // ไฟล์รูปกลางในเครื่องก็ต้องตัดตาม ไม่งั้น build-marketplace-images เจอใบที่ลบไปแล้ว
    for (const f of fs.readdirSync(outDir)) {
      if (!midItems.some(m => path.basename(m.key) === f)) fs.unlinkSync(path.join(outDir, f));
    }
  } else {
    log(`⚠ ข้ามการลบไฟล์ค้าง — ชุดต้นฉบับไม่ครบ ถ้าลบจะทำลายรูปกลางที่ลิสต์ marketplace ใช้อยู่`);
  }

  upsertCatalog({ code, slug, title: title || dirName || code, dirName, count: midUrls.length, images: midUrls });

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

async function download(keys) {
  const out = [];
  for (const k of keys) {
    const res = await fetch(r2.urlOf(k.key));
    if (!res.ok) continue;
    out.push({ name: path.basename(k.key), body: Buffer.from(await res.arrayBuffer()) });
  }
  return out;
}

/**
 * ดึงต้นฉบับกลับจาก R2 (ใช้ตอน NAS ไม่ได้ต่อแต่อยากทำรูปใหม่)
 * list ด้วย prefix `originals/<code>-` เฉย ๆ ไม่ผูกกับ slug — สินค้าที่เคยเปลี่ยนชื่อ
 * โฟลเดอร์ originals ยังเป็น slug เดิม ถ้าใส่ slug ปัจจุบันเข้าไปจะหาไม่เจอทั้งที่มีของอยู่
 */
async function fetchOriginals(code) {
  const keys = (await r2.listKeys(`originals/${code}-`)).filter(k => IMG_EXT.test(k.key));
  return download(keys.sort((a, b) => webImg.byNaturalName(a.key, b.key)));
}

/**
 * ทางถอยสุดท้าย: ดึง "รูปกลาง 1200" กลับมาใช้แทนต้นฉบับ
 * สำหรับสินค้าเก่าที่ลงไว้ก่อนมีชั้น originals/ (NAS ก็ไม่ได้ต่อ) — คุณภาพพอทำรูปเว็บ ≤800 ได้สบาย
 */
async function fetchMids(code) {
  const keys = (await r2.listKeys(`products/${code}/`)).filter(k => IMG_EXT.test(k.key));
  return download(keys.sort((a, b) => webImg.byNaturalName(a.key, b.key)));
}

module.exports = { processProductImages, fetchOriginals, fetchMids, loadCatalog, upsertCatalog, MID_SIZE, MAX_IMAGES };
