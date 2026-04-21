#!/usr/bin/env node
/**
 * Batch resize + compress รูปในโฟลเดอร์ images/
 *
 * Usage:
 *   node scripts/optimize-images.js           # dry-run (แสดงรายงานเฉยๆ ไม่แก้ไฟล์)
 *   node scripts/optimize-images.js --apply   # ทำจริง (backup ของเดิมที่ images/original/)
 *   node scripts/optimize-images.js --apply --force  # บังคับทำซ้ำแม้ backup มีอยู่แล้ว
 *
 * กฎการปรับขนาด (แก้ได้ในตัวแปร TARGETS):
 *   - hero*       → 1600x900   (desktop banner)
 *   - mobile-hero → 750x1000
 *   - logo1       → 1200x630   (OG image)
 *   - อื่น ๆ (สินค้า) → 800x800 (อัตราส่วนเดิม, ไม่ขยาย)
 *
 * Skip:
 *   - favicon/logo เล็ก, social icons (<10KB), รูปใน optimized/ หรือ original/
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'images');
const BACKUP_DIR = path.join(IMG_DIR, 'original');

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');

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

async function main() {
  if (!fs.existsSync(IMG_DIR)) {
    console.error('images/ directory not found');
    process.exit(1);
  }

  const files = fs.readdirSync(IMG_DIR)
    .filter(f => /\.(webp|jpg|jpeg|png)$/i.test(f))
    .filter(f => !fs.statSync(path.join(IMG_DIR, f)).isDirectory());

  console.log(`Mode: ${APPLY ? 'APPLY (will overwrite)' : 'DRY-RUN (report only)'}`);
  console.log(`Found ${files.length} images\n`);

  let totalBefore = 0, totalAfter = 0, processedCount = 0, skippedCount = 0;

  for (const file of files) {
    try {
      const r = await processOne(file);
      if (r.skipped) {
        console.log(`  SKIP  ${file.padEnd(60)}  ${fmtKB(r.before).padStart(10)}  (${r.skipped})`);
        skippedCount++;
        continue;
      }
      const bestSize = Math.min(r.avifSize, r.webpSize);
      const pct = ((1 - bestSize / r.before) * 100).toFixed(0);
      console.log(
        `  ${r.applied ? ' OK  ' : 'PLAN '}${file.padEnd(60)}  ` +
        `${fmtKB(r.before).padStart(10)} → webp ${fmtKB(r.webpSize).padStart(9)} / avif ${fmtKB(r.avifSize).padStart(9)}  (-${pct}%)`
      );
      totalBefore += r.before;
      totalAfter += bestSize;
      processedCount++;
    } catch (err) {
      console.log(`  ERR   ${file}:  ${err.message}`);
    }
  }

  console.log('\n── Summary ──────────────────────────────');
  console.log(`  Processed: ${processedCount}   Skipped: ${skippedCount}`);
  console.log(`  Total size:  ${fmtKB(totalBefore)}  →  ${fmtKB(totalAfter)}`);
  if (totalBefore > 0) {
    const savedPct = ((1 - totalAfter / totalBefore) * 100).toFixed(1);
    console.log(`  Savings:     ${fmtKB(totalBefore - totalAfter)}  (-${savedPct}%)`);
  }
  if (!APPLY) {
    console.log('\n  รัน `node scripts/optimize-images.js --apply` เพื่อเริ่มจริง');
    console.log('  ไฟล์ต้นฉบับจะ backup ไว้ที่ images/original/');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
