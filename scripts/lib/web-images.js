/**
 * สร้างรูปสำหรับ "หน้าเว็บ" จากไฟล์ต้นฉบับบน NAS
 *
 *   ต้นฉบับ (เก็บไว้ตลอด)  Z:\photos\รูปสินค้า\<NN>-<ชื่อ>\หลัก_01.jpg
 *   เว็บ (เร็ว + ชื่อ SEO)  images/products/<slug>/<slug>-1.webp  (+ .avif เคียงข้าง)
 *   marketplace (1200px)   marketplace-images/products/<NN>/  → R2  (build-marketplace-images.js)
 *
 * สเปกตรงกับ optimize-images.js: inside 800x800, webp q72 / avif q50, effort 6
 * → หน้าสินค้าโหลดเร็วเท่าสินค้าเดิม ไม่ดึง jpg 1200px จาก CDN มาแสดง
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..', '..');
const WEB_DIR = path.join(ROOT, 'images', 'products');
const MAX_W = 800, MAX_H = 800, WEBP_Q = 72, AVIF_Q = 50;
const IMG_EXT = /\.(jpe?g|png|webp|avif|tiff?|bmp)$/i;

function listWebDirs() {
  try { return fs.readdirSync(WEB_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); }
  catch { return []; }
}

/** ไฟล์รูปในโฟลเดอร์ NAS เรียงตามเลขท้ายชื่อ (หลัก_01, หลัก_02, ...) */
function listSourceImages(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(f => f.isFile() && IMG_EXT.test(f.name))
    .map(f => f.name)
    .sort((a, b) => {
      const na = parseInt((a.match(/(\d+)(?=\.[^.]+$)/) || [])[1] || '0', 10);
      const nb = parseInt((b.match(/(\d+)(?=\.[^.]+$)/) || [])[1] || '0', 10);
      return na - nb || a.localeCompare(b);
    })
    .map(n => path.join(dir, n));
}

async function encodePair(srcBuffer) {
  const resize = () => sharp(srcBuffer).rotate().resize({
    width: MAX_W, height: MAX_H, fit: 'inside', withoutEnlargement: true,
  });
  return {
    webp: await resize().webp({ quality: WEBP_Q, effort: 6 }).toBuffer(),
    avif: await resize().avif({ quality: AVIF_Q, effort: 6 }).toBuffer(),
  };
}

/**
 * แปลงรูปทั้งชุดเป็นรูปเว็บชื่อ SEO
 * @param {object} o
 * @param {string} [o.srcDir]     โฟลเดอร์ต้นฉบับบน NAS
 * @param {Buffer[]} [o.buffers]  หรือส่ง buffer มาตรง ๆ (กรณีอัปโหลดผ่านเว็บ)
 * @param {string} o.slug         slug SEO สำหรับชื่อโฟลเดอร์/ไฟล์
 * @param {number} [o.max]        จำนวนรูปสูงสุด
 * @returns {Promise<{urls:string[], dir:string, bytes:number}>} urls = /images/products/...webp
 */
async function buildWebImages({ srcDir, buffers, slug, max = 9 }) {
  if (!slug) throw new Error('buildWebImages: ต้องมี slug');
  const outDir = path.join(WEB_DIR, slug);
  fs.mkdirSync(outDir, { recursive: true });

  let sources = [];
  if (Array.isArray(buffers) && buffers.length) sources = buffers.slice(0, max);
  else if (srcDir) sources = listSourceImages(srcDir).slice(0, max).map(p => fs.readFileSync(p));
  if (!sources.length) throw new Error('ไม่พบรูปต้นฉบับสำหรับทำรูปเว็บ');

  // ลบไฟล์ชุดเดิมของ slug นี้ก่อน กันรูปเก่าค้างเมื่อจำนวนรูปลดลง
  for (const f of fs.readdirSync(outDir)) {
    if (/\.(webp|avif)$/i.test(f)) fs.unlinkSync(path.join(outDir, f));
  }

  const urls = [];
  let bytes = 0;
  for (let i = 0; i < sources.length; i++) {
    const base = `${slug}-${i + 1}`;
    const { webp, avif } = await encodePair(sources[i]);
    fs.writeFileSync(path.join(outDir, `${base}.webp`), webp);
    fs.writeFileSync(path.join(outDir, `${base}.avif`), avif);
    bytes += webp.length + avif.length;
    urls.push(`/images/products/${slug}/${base}.webp`);
  }
  return { urls, dir: outDir, bytes };
}

/**
 * เปลี่ยนชื่อโฟลเดอร์/ไฟล์รูปเว็บของสินค้าเดิมให้เป็น slug ใหม่ (ทำ SEO ให้รูปเก่า)
 * ไม่แตะต้นฉบับบน NAS · ถ้าโฟลเดอร์ปลายทางมีอยู่แล้วจะไม่ทับ
 * @returns {{urls:string[], renamed:boolean}}
 */
function renameWebImages(oldSlug, newSlug) {
  const from = path.join(WEB_DIR, oldSlug);
  const to = path.join(WEB_DIR, newSlug);
  if (oldSlug === newSlug || !fs.existsSync(from)) {
    return { urls: readWebUrls(oldSlug), renamed: false };
  }
  if (fs.existsSync(to)) throw new Error(`มีโฟลเดอร์รูป ${newSlug} อยู่แล้ว — เปลี่ยนชื่อสินค้าให้ต่างจากเดิม`);

  fs.renameSync(from, to);
  const files = fs.readdirSync(to).filter(f => /\.(webp|avif)$/i.test(f))
    .sort((a, b) => {
      const na = parseInt((a.match(/-(\d+)\.[^.]+$/) || [])[1] || '0', 10);
      const nb = parseInt((b.match(/-(\d+)\.[^.]+$/) || [])[1] || '0', 10);
      return na - nb || a.localeCompare(b);
    });
  for (const f of files) {
    const n = (f.match(/-(\d+)\.[^.]+$/) || [])[1] || '1';
    const ext = path.extname(f).toLowerCase();
    const next = `${newSlug}-${parseInt(n, 10)}${ext}`;
    if (f !== next) fs.renameSync(path.join(to, f), path.join(to, next));
  }
  return { urls: readWebUrls(newSlug), renamed: true };
}

/** URL รูปเว็บ (.webp) ของ slug เรียงตามเลข */
function readWebUrls(slug) {
  const dir = path.join(WEB_DIR, slug);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.webp$/i.test(f))
    .sort((a, b) => (parseInt((a.match(/-(\d+)\.webp$/i) || [])[1] || '0', 10)) - (parseInt((b.match(/-(\d+)\.webp$/i) || [])[1] || '0', 10)))
    .map(f => `/images/products/${slug}/${f}`);
}

module.exports = { buildWebImages, renameWebImages, readWebUrls, listWebDirs, listSourceImages, WEB_DIR };
