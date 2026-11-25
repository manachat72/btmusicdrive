#!/usr/bin/env node
/**
 * Batch resize + compress รูปในโฟลเดอร์ images/
 *
 * Usage:
 *   node scripts/optimize-images.js                     # dry-run รูปสินค้า
 *   node scripts/optimize-images.js --apply             # ทำจริง (backup ที่ images/original/)
 *   node scripts/optimize-images.js --apply --force     # บังคับทำซ้ำแม้ backup มีอยู่แล้ว
 *   node scripts/optimize-images.js --category          # dry-run รูป category
 *   node scripts/optimize-images.js --category --apply  # ทำจริงรูป category
 *
 * กฎการปรับขนาด:
 *   - hero*       → 1600x900   (desktop banner)
 *   - mobile-hero → 750x1000
 *   - logo1       → 1200x630   (OG image)
 *   - category/*  → 800x800    (max grid display 2× retina)
 *   - อื่น ๆ (สินค้า) → 800x800
 *
 * Skip:
 *   - favicon/logo เล็ก, social icons (<10KB), รูปใน original/ หรือ with_metadata/
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'images');
const BACKUP_DIR = path.join(IMG_DIR, 'original');
const CAT_DIR = path.join(IMG_DIR, 'category');
const CAT_BACKUP_DIR = path.join(IMG_DIR, 'with_metadata', 'category');

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const CATEGORY_MODE = process.argv.includes('--category');

const TARGETS = [
  { match: /^hero-banner/i,  maxW: 1600, maxH: 900,  avifQ: 55, webpQ: 75 },
  { match: /^mobile-hero/i,  maxW: 750,  maxH: 1000, avifQ: 50, webpQ: 72 },
  { match: /^logo1\./i,      maxW: 1200, maxH: 630,  avifQ: 60, webpQ: 80 },
  // default — รูปสินค้า
  { match: /.*/,             maxW: 800,  maxH: 800,  avifQ: 50, webpQ: 72 },
];

const SKIP_PATTERNS = [
  /^logo\.|^logo \(/i,        // logo เล็ก favicon
  /^(shopeer|lazada|tiktok)\./i,  // social icons
];

function pickTarget(filename) {
  return TARGETS.find(t => t.match.test(filename));
}

function shouldSkip(filename, sizeBytes) {
  if (SKIP_PATTERNS.some(p => p.test(filename))) return 'social/logo icon';
  if (sizeBytes < 10 * 1024) return 'already <10KB';
  return null;
}

function fmtKB(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

async function processOne(file) {
  const srcPath = path.join(IMG_DIR, file);
  const stat = fs.statSync(srcPath);
  const skipReason = shouldSkip(file, stat.size);
  if (skipReason) {
    return { file, skipped: skipReason, before: stat.size };
  }

  const target = pickTarget(file);
  const ext = path.extname(file).toLowerCase();
  const base = file.slice(0, -ext.length);

  // อ่านเป็น buffer ก่อน เพื่อเลี่ยง Windows file-lock ตอน overwrite
  const srcBuffer = fs.readFileSync(srcPath);
  const meta = await sharp(srcBuffer).metadata();

  const resize = () => sharp(srcBuffer).rotate().resize({
    width: target.maxW,
    height: target.maxH,
    fit: 'inside',
    withoutEnlargement: true,
  });

  const avifBuf = await resize().avif({ quality: target.avifQ, effort: 6 }).toBuffer();
  const webpBuf = await resize().webp({ quality: target.webpQ, effort: 6 }).toBuffer();

  const report = {
    file,
    before: stat.size,
    meta: `${meta.width}x${meta.height}`,
    target: `${target.maxW}x${target.maxH}`,
    avifSize: avifBuf.length,
    webpSize: webpBuf.length,
    saved: stat.size - Math.min(avifBuf.length, webpBuf.length),
  };

  if (APPLY) {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const backupPath = path.join(BACKUP_DIR, file);
    if (!fs.existsSync(backupPath) || FORCE) {
      fs.copyFileSync(srcPath, backupPath);
    }
    // เขียน .webp ทับของเดิม (ชื่อเดิมที่ HTML อ้างถึง)
    if (ext === '.webp' || ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
      const outWebp = path.join(IMG_DIR, base + '.webp');
      fs.writeFileSync(outWebp, webpBuf);
      // ลบไฟล์เดิมถ้า ext ไม่ใช่ .webp (เช่น .png → .webp)
      if (ext !== '.webp' && fs.existsSync(srcPath) && srcPath !== outWebp) {
        fs.unlinkSync(srcPath);
      }
    }
    // เขียน .avif เคียงข้าง
    const outAvif = path.join(IMG_DIR, base + '.avif');
    fs.writeFileSync(outAvif, avifBuf);
    report.applied = true;
  }

  return report;
}

// ── Category image processor ─────────────────────────────────────────────────

async function processCategoryOne(file) {
  const srcPath = path.join(CAT_DIR, file);
  const stat = fs.statSync(srcPath);
  if (stat.size < 10 * 1024) return { file, skipped: 'already <10KB', before: stat.size };

  const srcBuffer = fs.readFileSync(srcPath);
  const meta = await sharp(srcBuffer).metadata();

  // Category images: max 800×800, object-cover → only longest edge matters
  const resize = () => sharp(srcBuffer).rotate().resize({
    width: 800, height: 800, fit: 'inside', withoutEnlargement: true,
  });

  const avifBuf = await resize().avif({ quality: 48, effort: 6 }).toBuffer();
  const webpBuf = await resize().webp({ quality: 70, effort: 6 }).toBuffer();

  const ext = path.extname(file).toLowerCase();
  const base = file.slice(0, -ext.length);

  const report = {
    file,
    before: stat.size,
    meta: `${meta.width}x${meta.height}`,
    avifSize: avifBuf.length,
    webpSize: webpBuf.length,
    saved: stat.size - Math.min(avifBuf.length, webpBuf.length),
  };

  if (APPLY) {
    if (!fs.existsSync(CAT_BACKUP_DIR)) fs.mkdirSync(CAT_BACKUP_DIR, { recursive: true });
    const backupPath = path.join(CAT_BACKUP_DIR, file);
    if (!fs.existsSync(backupPath) || FORCE) fs.copyFileSync(srcPath, backupPath);

    // Overwrite .webp with re-compressed version
    fs.writeFileSync(path.join(CAT_DIR, base + '.webp'), webpBuf);
    if (ext !== '.webp' && fs.existsSync(srcPath)) fs.unlinkSync(srcPath);

    // Write .avif alongside
    fs.writeFileSync(path.join(CAT_DIR, base + '.avif'), avifBuf);
    report.applied = true;
  }

  return report;
}

async function runPass(label, files, processFn) {
  console.log(`\n── ${label} ${'─'.repeat(Math.max(0, 40 - label.length))}`);
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}   Files: ${files.length}\n`);

  let totalBefore = 0, totalAfter = 0, processed = 0, skipped = 0;

  for (const file of files) {
    try {
      const r = await processFn(file);
      if (r.skipped) {
        console.log(`  SKIP  ${file.padEnd(55)}  ${fmtKB(r.before).padStart(9)}  (${r.skipped})`);
        skipped++;
        continue;
      }
      const bestSize = Math.min(r.avifSize, r.webpSize);
      const pct = ((1 - bestSize / r.before) * 100).toFixed(0);
      console.log(
        `  ${r.applied ? ' OK ' : 'PLAN'}  ${file.padEnd(55)}  ` +
        `${fmtKB(r.before).padStart(9)} → webp ${fmtKB(r.webpSize).padStart(8)} / avif ${fmtKB(r.avifSize).padStart(8)}  (-${pct}%)`
      );
      totalBefore += r.before;
      totalAfter += bestSize;
      processed++;
    } catch (err) {
      console.log(`  ERR   ${file}:  ${err.message}`);
    }
  }

  console.log(`\n  Processed: ${processed}   Skipped: ${skipped}`);
  console.log(`  Total:  ${fmtKB(totalBefore)}  →  ${fmtKB(totalAfter)}  (saved ${fmtKB(totalBefore - totalAfter)}, -${totalBefore > 0 ? ((1 - totalAfter / totalBefore) * 100).toFixed(1) : 0}%)`);
  return { totalBefore, totalAfter };
}

async function main() {
  if (!fs.existsSync(IMG_DIR)) { console.error('images/ not found'); process.exit(1); }

  if (CATEGORY_MODE) {
    if (!fs.existsSync(CAT_DIR)) { console.error('images/category/ not found'); process.exit(1); }
    const catFiles = fs.readdirSync(CAT_DIR)
      .filter(f => /\.(webp|jpg|jpeg|png)$/i.test(f))
      .filter(f => !fs.statSync(path.join(CAT_DIR, f)).isDirectory());
    await runPass('Category images (images/category/)', catFiles, processCategoryOne);
    if (!APPLY) console.log('\n  รัน `node scripts/optimize-images.js --category --apply` เพื่อเริ่มจริง');
    return;
  }

  const rootFiles = fs.readdirSync(IMG_DIR)
    .filter(f => /\.(webp|jpg|jpeg|png)$/i.test(f))
    .filter(f => !fs.statSync(path.join(IMG_DIR, f)).isDirectory());

  await runPass('Product images (images/)', rootFiles, processOne);
  if (!APPLY) console.log('\n  รัน `node scripts/optimize-images.js --apply` เพื่อเริ่มจริง');
}

main().catch(err => { console.error(err); process.exit(1); });
