#!/usr/bin/env node
/**
 * สร้างชุดรูปสินค้า "กลาง" สำหรับ Shopee / Lazada / TikTok Shop / เว็บ
 *
 * อ่านจาก NAS:  Z:\รูป\รูปสินค้า\<NN>-<ชื่อสินค้า>\หลัก_01.jpg ...
 * เขียนออกที่:  marketplace-images/products/<NN>/<NN>-01.jpg ...
 *               marketplace-images/catalog.json
 *               marketplace-images/catalog.csv       (คอลัมน์ Image 1-9 พร้อมวางลงเทมเพลต)
 *
 * สเปกที่ใช้ — ครอบคลุมทุก marketplace:
 *   JPEG 1200x1200 (pad ขาวถ้าไม่จัตุรัส) quality 88 progressive, strip metadata
 *   Shopee: แนะนำ 1024+ / Lazada: 330-5000 / TikTok Shop: ขั้นต่ำ 600 แนะนำ 800+
 *
 * Usage:
 *   node scripts/build-marketplace-images.js            # dry-run (แค่รายงาน)
 *   node scripts/build-marketplace-images.js --apply    # ทำจริง
 *   node scripts/build-marketplace-images.js --apply --force   # เขียนทับไฟล์เดิม
 *   node scripts/build-marketplace-images.js --apply --src "D:\\path"  # เปลี่ยน source
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'marketplace-images');
const OUT_PRODUCTS = path.join(OUT_DIR, 'products');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const FORCE = argv.includes('--force');
const argVal = (flag, def) => {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : def;
};

const SRC_DIR = argVal('--src', 'Z:\\รูป\\รูปสินค้า');
const CDN_BASE = (argVal('--cdn', process.env.CDN_BASE || 'https://img.btmusicdrive.com')).replace(/\/$/, '');

const SIZE = parseInt(argVal('--size', '1200'), 10);
const QUALITY = parseInt(argVal('--quality', '88'), 10);
const MAX_IMAGES = parseInt(argVal('--max', '9'), 10); // Shopee/TikTok รับได้ 9, Lazada 8

const IMG_EXT = /\.(jpe?g|png|webp|avif|tiff?|bmp)$/i;

function listProductDirs() {
  return fs.readdirSync(SRC_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort((a, b) => a.localeCompare(b, 'th'));
}

/** "37-USB แฟลชไดรฟ์ MP3 ..." → { code: '37', title: 'USB แฟลชไดรฟ์ MP3 ...' } */
function parseDirName(name) {
  const m = name.match(/^(\d+)\s*-\s*(.*)$/);
  if (m) return { code: m[1].padStart(2, '0'), title: m[2].trim() };
  return { code: null, title: name.trim() };
}

function listImages(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(f => f.isFile() && IMG_EXT.test(f.name))
    .map(f => f.name)
    // เรียงตามเลขท้ายชื่อ (หลัก_01, หลัก_02, ... หลัก_10)
    .sort((a, b) => {
      const na = parseInt((a.match(/(\d+)(?=\.[^.]+$)/) || [])[1] || '0', 10);
      const nb = parseInt((b.match(/(\d+)(?=\.[^.]+$)/) || [])[1] || '0', 10);
      return na - nb || a.localeCompare(b);
    });
}

async function convertOne(srcPath, outPath) {
  const buf = fs.readFileSync(srcPath);
  const out = await sharp(buf)
    .rotate()
    .resize({
      width: SIZE,
      height: SIZE,
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
      withoutEnlargement: false,
    })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: QUALITY, progressive: true, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer();
  if (APPLY) fs.writeFileSync(outPath, out);
  return out.length;
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

(async () => {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`✖ ไม่พบโฟลเดอร์ต้นทาง: ${SRC_DIR}`);
    console.error('  ถ้า NAS ยังไม่ได้ map ไดรฟ์ ให้เชื่อมต่อก่อน หรือระบุ --src "<path>"');
    process.exit(1);
  }

  console.log(`source : ${SRC_DIR}`);
  console.log(`output : ${OUT_DIR}`);
  console.log(`cdn    : ${CDN_BASE}`);
  console.log(`spec   : JPEG ${SIZE}x${SIZE} q${QUALITY} (pad ขาว) · สูงสุด ${MAX_IMAGES} รูป/สินค้า`);
  console.log(APPLY ? '\n=== APPLY ===\n' : '\n=== DRY RUN (ใส่ --apply เพื่อทำจริง) ===\n');

  if (APPLY) fs.mkdirSync(OUT_PRODUCTS, { recursive: true });

  const dirs = listProductDirs();
  const catalog = [];
  let totalIn = 0, totalOut = 0, totalFiles = 0, skipped = 0;

  for (const dirName of dirs) {
    const { code, title } = parseDirName(dirName);
    if (!code) {
      console.warn(`  ⚠ ข้าม "${dirName}" (ไม่มีเลขนำหน้า)`);
      continue;
    }

    const srcDir = path.join(SRC_DIR, dirName);
    const files = listImages(srcDir).slice(0, MAX_IMAGES);
    if (!files.length) {
      console.warn(`  ⚠ ${code}: ไม่มีไฟล์รูป`);
      continue;
    }

    const outDir = path.join(OUT_PRODUCTS, code);
    if (APPLY) fs.mkdirSync(outDir, { recursive: true });

    const urls = [];
    let dirIn = 0, dirOut = 0;

    for (let i = 0; i < files.length; i++) {
      const seq = String(i + 1).padStart(2, '0');
      const outName = `${code}-${seq}.jpg`;
      const srcPath = path.join(srcDir, files[i]);
      const outPath = path.join(outDir, outName);

      dirIn += fs.statSync(srcPath).size;

      if (!FORCE && APPLY && fs.existsSync(outPath)) {
        dirOut += fs.statSync(outPath).size;
        skipped++;
      } else {
        dirOut += await convertOne(srcPath, outPath);
        totalFiles++;
      }
      urls.push(`${CDN_BASE}/products/${code}/${outName}`);
    }

    totalIn += dirIn;
    totalOut += dirOut;
    catalog.push({ code, title, dirName, count: urls.length, images: urls });
    console.log(`  ${code}  ${String(urls.length).padStart(2)} รูป  ${(dirIn / 1048576).toFixed(1)}MB → ${(dirOut / 1048576).toFixed(1)}MB  ${title.slice(0, 45)}`);
  }

  // --- catalog.json ---
  const jsonPath = path.join(OUT_DIR, 'catalog.json');
  const json = JSON.stringify({ cdnBase: CDN_BASE, generatedAt: new Date().toISOString(), products: catalog }, null, 2);

  // --- catalog.csv (วางลงเทมเพลต mass upload ได้เลย) ---
  const header = ['Code', 'Product Name', 'Image Count', ...Array.from({ length: MAX_IMAGES }, (_, i) => `Image ${i + 1}`)];
  const rows = catalog.map(p => [
    p.code, p.title, p.count,
    ...Array.from({ length: MAX_IMAGES }, (_, i) => p.images[i] || ''),
  ]);
  const csv = '\uFEFF' + [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

  if (APPLY) {
    fs.writeFileSync(jsonPath, json, 'utf8');
    fs.writeFileSync(path.join(OUT_DIR, 'catalog.csv'), csv, 'utf8');
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`สินค้า      : ${catalog.length} รายการ`);
  console.log(`รูปแปลงใหม่ : ${totalFiles} ไฟล์${skipped ? ` (ข้ามของเดิม ${skipped})` : ''}`);
  console.log(`ขนาดรวม     : ${(totalIn / 1048576).toFixed(1)}MB → ${(totalOut / 1048576).toFixed(1)}MB`);
  if (APPLY) {
    console.log(`\n✔ เขียนแล้ว: marketplace-images/products/, catalog.json, catalog.csv`);
    console.log(`  ขั้นถัดไป: node scripts/upload-r2.js --apply`);
  } else {
    console.log('\n(dry run — ยังไม่เขียนไฟล์ ใส่ --apply เพื่อทำจริง)');
  }
})().catch(err => {
  console.error('✖', err);
  process.exit(1);
});
