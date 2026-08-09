#!/usr/bin/env node
/**
 * อัปโหลด marketplace-images/ ขึ้น Cloudflare R2 (S3-compatible)
 *
 * ต้องมีไฟล์ .env.r2 ที่ root (gitignored):
 *   R2_ACCOUNT_ID=xxxxxxxxxxxxxxxx
 *   R2_ACCESS_KEY_ID=xxxxxxxx
 *   R2_SECRET_ACCESS_KEY=xxxxxxxx
 *   R2_BUCKET=btmusicdrive-img
 *
 * Usage:
 *   node scripts/upload-r2.js               # dry-run
 *   node scripts/upload-r2.js --apply       # อัปจริง (ข้ามไฟล์ที่ขนาดตรงกันอยู่แล้ว)
 *   node scripts/upload-r2.js --apply --force   # อัปทับทุกไฟล์
 */
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'marketplace-images');

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');

// --- โหลด .env.r2 ---
const envPath = path.join(ROOT, '.env.r2');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']
  .filter(k => !process.env[k]);
if (missing.length) {
  console.error(`✖ ขาด env: ${missing.join(', ')} — ตั้งใน .env.r2 ที่ root`);
  process.exit(1);
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.csv': 'text/csv; charset=utf-8' };

function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

(async () => {
  if (!fs.existsSync(SRC)) {
    console.error('✖ ยังไม่มี marketplace-images/ — รัน node scripts/build-marketplace-images.js --apply ก่อน');
    process.exit(1);
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });

  // ไม่อัป catalog.csv/json ขึ้น public (เก็บไว้ใช้ในเครื่อง)
  const keys = walk(SRC).filter(k => k.startsWith('products/'));
  console.log(`bucket : ${R2_BUCKET}`);
  console.log(`ไฟล์   : ${keys.length}`);
  console.log(APPLY ? '\n=== APPLY ===\n' : '\n=== DRY RUN (ใส่ --apply เพื่ออัปจริง) ===\n');

  let uploaded = 0, skipped = 0, failed = 0, bytes = 0;

  for (const key of keys) {
    const full = path.join(SRC, key);
    const size = fs.statSync(full).size;

    if (APPLY && !FORCE) {
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
        if (head.ContentLength === size) { skipped++; continue; }
      } catch (_) { /* ไม่มีไฟล์ → อัปต่อ */ }
    }

    if (!APPLY) { uploaded++; bytes += size; continue; }

    try {
      await client.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: fs.readFileSync(full),
        ContentType: MIME[path.extname(key).toLowerCase()] || 'application/octet-stream',
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      uploaded++; bytes += size;
      if (uploaded % 25 === 0) console.log(`  ...${uploaded} ไฟล์`);
    } catch (err) {
      failed++;
      console.error(`  ✖ ${key}: ${err.message}`);
    }
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`อัปโหลด : ${uploaded} ไฟล์ (${(bytes / 1048576).toFixed(1)}MB)`);
  if (skipped) console.log(`ข้าม    : ${skipped} (มีอยู่แล้ว ขนาดตรงกัน)`);
  if (failed) console.log(`ล้มเหลว : ${failed}`);
  if (APPLY && !failed) console.log('\n✔ เสร็จ — ลิงก์อยู่ใน marketplace-images/catalog.csv');
})().catch(err => {
  console.error('✖', err);
  process.exit(1);
});
