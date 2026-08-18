/**
 * R2 helper — อัปหลายไฟล์ใน client เดียว (เร็วกว่า spawn upload-r2-file.js ต่อไฟล์)
 * ใช้ .env.r2 ตัวเดียวกับ upload-r2.js / upload-r2-file.js
 */
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, HeadObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const ROOT = path.resolve(__dirname, '..', '..');
const CDN = 'https://img.btmusicdrive.com';

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.avif': 'image/avif', '.tif': 'image/tiff', '.tiff': 'image/tiff', '.bmp': 'image/bmp',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
};

function loadEnv() {
  const p = path.join(ROOT, '.env.r2');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

let _client = null;
function client() {
  if (_client) return _client;
  loadEnv();
  const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'].filter(k => !process.env[k]);
  if (missing.length) throw new Error(`ขาด env ใน .env.r2: ${missing.join(', ')}`);
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  });
  return _client;
}

const bucket = () => process.env.R2_BUCKET;

/** URL สาธารณะของ key (encode เฉพาะอักขระที่ต้อง — ชื่อไทยใช้ได้) */
const urlOf = (key) => `${CDN}/${encodeURI(key.replace(/^\/+/, ''))}`;

async function exists(key) {
  try { await client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key })); return true; }
  catch { return false; }
}

/**
 * อัปไฟล์เดียว
 * @param {string} key
 * @param {Buffer} body
 * @param {object} [o] {cacheControl, skipIfExists}
 */
async function putObject(key, body, o = {}) {
  key = key.replace(/^\/+/, '');
  if (o.skipIfExists && await exists(key)) return { key, url: urlOf(key), skipped: true };
  await client().send(new PutObjectCommand({
    Bucket: bucket(), Key: key, Body: body,
    ContentType: MIME[path.extname(key).toLowerCase()] || 'application/octet-stream',
    // ต้นฉบับแทบไม่เปลี่ยน — cache ยาวได้ · รูปกลางใช้ค่า default 1 วัน
    CacheControl: o.cacheControl || 'public, max-age=86400',
  }));
  return { key, url: urlOf(key), skipped: false };
}

/** อัปหลายไฟล์พร้อมกันแบบจำกัดคิว (ไม่ยิงทีเดียว 100 ไฟล์) */
async function putMany(items, { concurrency = 6, onProgress } = {}) {
  const out = [];
  let i = 0, done = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      const it = items[idx];
      out[idx] = await putObject(it.key, it.body, it);
      done++;
      if (onProgress) onProgress(done, items.length, out[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}

/** list key ทั้งหมดใต้ prefix */
async function listKeys(prefix) {
  const keys = [];
  let token;
  do {
    const r = await client().send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }));
    (r.Contents || []).forEach(o => keys.push({ key: o.Key, size: o.Size }));
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

module.exports = { putObject, putMany, listKeys, exists, urlOf, CDN };
