#!/usr/bin/env node
'use strict';
/**
 * ขั้นที่ 1 ของระบบทำวิดีโอ: SKU → videos/flow/<SKU>/facts.json + รูปปกสินค้า (cover.webp)
 *
 *   node scripts/video/product-facts.js BT-ST-04-043 [BT-LT-08-045 ...]
 *
 * ข้อมูลมาจาก products.json เท่านั้น (ห้ามเดา) · ไม่มีราคาใน facts เพราะบทพูดห้ามเอ่ยราคา
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..', '..');
const JOBS = path.join(ROOT, 'videos', 'flow');

const CATEGORY_TONE = {
  PC: 'เพื่อชีวิต จริงใจ อบอุ่น ถนนต่างจังหวัด',
  ST: 'สนุก คิดถึงวันวาน สดใส',
  TA: 'บ้านเกิดแดนใต้ อบอุ่น เป็นกันเอง',
  IN: 'ทันสมัย มีสไตล์ ฟีลดี',
  LK: 'คลาสสิก หวานซึ้ง ย้อนยุค',
  LT: 'ลูกทุ่ง สนุกสนาน บ้าน ๆ อบอุ่น',
  DZ: 'มันส์ คึกคัก ปาร์ตี้',
  DM: 'สงบ ผ่อนคลาย เป็นมงคล',
  RD: 'ย้อนวันวาน วิทยุ คิดถึง',
  AC: 'ใช้งานง่าย สะดวก',
};

function loadProducts() {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));
  return Array.isArray(raw) ? raw : raw.products || raw.data || [];
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} ${url}`));
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => out.close(resolve));
    }).on('error', reject);
  });
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function buildFacts(product) {
  const sku = product.sku;
  const dir = path.join(JOBS, sku);
  fs.mkdirSync(dir, { recursive: true });

  // รูปแรก = รูปปกพื้นขาว · ใช้ไฟล์ในเครื่องถ้ามี ไม่มีก็โหลดจาก CDN ของร้าน
  const first = (product.images && product.images[0]) || product.imageUrl || '';
  const coverPath = path.join(dir, 'cover' + (path.extname(first.split('?')[0]) || '.webp'));
  const local = path.join(ROOT, 'images', 'products', product.slug, `${product.slug}-1.webp`);
  if (fs.existsSync(local)) fs.copyFileSync(local, coverPath);
  else if (/^https?:\/\//.test(first)) await download(first, coverPath);
  else if (first) fs.copyFileSync(path.join(ROOT, first.replace(/^\//, '')), coverPath);

  const specs = product.specs || {};
  const catCode = (sku.split('-')[1] || '').toUpperCase();
  const tracks = product.tracklist || [];
  const facts = {
    sku,
    slug: product.slug,
    name: product.name,
    category: (product.category && product.category.name) || '',
    categoryCode: catCode,
    tone: CATEGORY_TONE[catCode] || 'อบอุ่น เป็นกันเอง',
    capacity: specs['ความจุ'] || '',
    trackCount: specs['จำนวนเพลง'] || (tracks.length ? `${tracks.length} เพลง` : ''),
    sampleTracks: tracks.slice(0, 8),
    tags: product.tags || [],
    summary: stripHtml(product.description).slice(0, 400),
    productUrl: `https://btmusicdrive.com/product/${product.slug}`,
    coverImage: path.relative(ROOT, coverPath).replace(/\\/g, '/'),
  };
  fs.writeFileSync(path.join(dir, 'facts.json'), JSON.stringify(facts, null, 2));

  const jobPath = path.join(dir, 'job.json');
  const job = fs.existsSync(jobPath) ? JSON.parse(fs.readFileSync(jobPath, 'utf8')) : { sku, attempts: 0, history: [] };
  job.status = 'facts_ready';
  job.updatedAt = new Date().toISOString();
  fs.writeFileSync(jobPath, JSON.stringify(job, null, 2));
  return facts;
}

async function main() {
  const skus = process.argv.slice(2).map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (!skus.length) {
    console.error('usage: node scripts/video/product-facts.js <SKU> [SKU...]');
    process.exit(1);
  }
  const products = loadProducts();
  let failed = 0;
  for (const sku of skus) {
    const p = products.find((x) => String(x.sku || '').toUpperCase() === sku);
    if (!p) {
      console.log(`✗ ${sku}: ไม่พบใน products.json`);
      failed++;
      continue;
    }
    try {
      const f = await buildFacts(p);
      console.log(`✓ ${sku}: ${f.name} · ${f.trackCount} · ${f.coverImage}`);
    } catch (e) {
      console.log(`✗ ${sku}: ${e.message}`);
      failed++;
    }
  }
  process.exit(failed ? 1 : 0);
}

main();
