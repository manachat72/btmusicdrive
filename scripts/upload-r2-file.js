#!/usr/bin/env node
/**
 * อัปไฟล์เดี่ยว (PDF / รูป / อะไรก็ได้) ขึ้น Cloudflare R2 → ได้ URL สาธารณะ
 * ใช้คู่กับ QR code บนกล่อง/การ์ดสินค้า — เปิด PDF เต็มจอทันที ไม่มีหน้า Drive คั่น
 *
 * Usage:
 *   node scripts/upload-r2-file.js "C:\path\to\file.pdf"                 # → docs/file.pdf
 *   node scripts/upload-r2-file.js "C:\path\file.pdf" docs/ชื่อใหม่.pdf   # ระบุ key เอง
 *   เพิ่ม --force เพื่ออัปทับของเดิม
 *
 * ต้องมี .env.r2 ที่ root (เหมือน upload-r2.js)
 */
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

const ROOT = path.resolve(__dirname, '..');
const CDN = 'https://img.btmusicdrive.com';

// โหลด .env.r2
for (const line of (fs.existsSync(path.join(ROOT, '.env.r2')) ? fs.readFileSync(path.join(ROOT, '.env.r2'), 'utf8').split('\n') : [])) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error('✖ ขาด env ใน .env.r2 (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET)');
  process.exit(1);
}

const MIME = {
  '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
};

(async () => {
  const argv = process.argv.slice(2).filter(a => a !== '--force');
  const FORCE = process.argv.includes('--force');
  const file = argv[0];
  if (!file || !fs.existsSync(file)) { console.error('✖ ระบุไฟล์: node scripts/upload-r2-file.js <file> [remote-key]'); process.exit(1); }
  const key = (argv[1] || `docs/${path.basename(file)}`).replace(/^\/+/, '');

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });

  if (!FORCE) {
    try {
      await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
      console.log(`มีไฟล์นี้อยู่แล้ว (ใส่ --force เพื่ออัปทับ)\n${CDN}/${key}`);
      return;
    } catch { }
  }

  const body = fs.readFileSync(file);
  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET, Key: key, Body: body,
    ContentType: MIME[path.extname(key).toLowerCase()] || 'application/octet-stream',
    CacheControl: 'public, max-age=86400',
  }));
  console.log(`✔ อัปแล้ว ${(body.length / 1e6).toFixed(1)} MB`);
  console.log(`${CDN}/${encodeURI(key)}`);
})().catch(e => { console.error('✖', e.message); process.exit(1); });
