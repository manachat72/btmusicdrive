/**
 * rename-slugs.mjs
 * เปลี่ยน slug ยาวของ 35 สินค้าให้สั้นและ SEO-friendly
 * รัน: node server/scripts/rename-slugs.mjs
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.join(__dirname, '..', '..');
const IMAGES_DIR = path.join(BASE, 'images', 'products');
const JSON_PATH = path.join(BASE, 'products.json');

// Load env
const envRaw = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([^=]+)="?([^"]*)"?$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const prisma = new PrismaClient();

// ── Mapping SKU → slug ใหม่ ──────────────────────────────────────────────────
const SKU_TO_NEW_SLUG = {
  'SKU-051': 'usb-mp3-dance-vol2',
  'SKU-052': 'usb-mp3-dhamma-pensiree',
  'SKU-053': 'usb-mp3-hits-2000',
  'SKU-054': 'usb-mp3-tai-sato',
  'SKU-056': 'usb-mp3-international-hits',
  'SKU-057': 'usb-mp3-tai-hit',
  'SKU-058': 'usb-mp3-rock-memories',
  'SKU-060': 'usb-mp3-string-90s',
  'SKU-063': 'usb-mp3-tai-phroaa',
  'SKU-067': 'usb-mp3-world-hits',
  'SKU-069': 'usb-mp3-luk-krung-amata',
  'SKU-071': 'usb-mp3-luk-thung-indy-4gb',
  'SKU-073': 'usb-mp3-luk-thung-amata',
  'SKU-075': 'usb-mp3-isan-indy',
  'SKU-078': 'usb-mp3-luk-thung-100',
  'SKU-079': 'usb-mp3-kru-sla',
  'SKU-080': 'usb-mp3-sek-loso',
  'SKU-081': 'usb-mp3-100-million-views',
  'SKU-082': 'usb-mp3-rock-90s',
  'SKU-083': 'usb-mp3-hit-nai-rot',
  'SKU-085': 'usb-mp3-suat-mon',
  'SKU-086': 'usb-mp3-carabao-4gb',
  'SKU-087': 'usb-mp3-got-jakrapat',
  'SKU-088': 'usb-mp3-santi-duangsaw',
  'SKU-089': 'usb-mp3-luk-krung-4gb',
  'SKU-091': 'usb-mp3-rock-legend',
  'SKU-092': 'usb-mp3-pong-pat',
  'SKU-094': 'usb-mp3-rock-wan-kao',
  'SKU-095': 'usb-mp3-90s-classic',
  'SKU-096': 'usb-mp3-tai-dontri',
  'SKU-097': 'usb-mp3-carabao-2gb',
  'SKU-099': 'usb-mp3-thai-rock-2000',
  'SKU-100': 'usb-mp3-rock-classic-90',
  'SKU-101': 'usb-mp3-phuea-chiwit-2',
  'SKU-102': 'usb-mp3-tiktok-hits',
};

function renameImageFolder(oldSlug, newSlug) {
  const oldDir = path.join(IMAGES_DIR, oldSlug);
  const newDir = path.join(IMAGES_DIR, newSlug);

  if (!fs.existsSync(oldDir)) {
    console.log(`    [ข้าม] ไม่พบโฟลเดอร์ ${oldSlug}`);
    return [];
  }

  fs.mkdirSync(newDir, { recursive: true });

  const files = fs.readdirSync(oldDir);
  const newPaths = [];

  for (const file of files) {
    const ext = path.extname(file);
    // ชื่อไฟล์เก่า: {oldSlug}-{n}.{ext}  →  ใหม่: {newSlug}-{n}.{ext}
    const numMatch = file.match(/-(\d+)\.[^.]+$/);
    if (!numMatch) continue;
    const n = numMatch[1];
    const newFile = `${newSlug}-${n}${ext}`;
    fs.renameSync(path.join(oldDir, file), path.join(newDir, newFile));
    if (ext === '.webp') {
      newPaths.push(`/images/products/${newSlug}/${newSlug}-${n}.webp`);
    }
  }

  fs.rmdirSync(oldDir);
  return newPaths.sort();
}

async function main() {
  console.log('='.repeat(55));
  console.log('  เปลี่ยน slug ยาว → สั้น');
  console.log('='.repeat(55));

  let doneCount = 0;
  let skipCount = 0;

  for (const [sku, newSlug] of Object.entries(SKU_TO_NEW_SLUG)) {
    const product = await prisma.product.findFirst({ where: { sku } });
    if (!product) {
      console.log(`\n[ข้าม] ไม่พบ ${sku} ใน DB`);
      skipCount++;
      continue;
    }

    const oldSlug = product.slug;
    if (oldSlug === newSlug) {
      console.log(`[ข้าม] ${sku} slug ถูกต้องแล้ว`);
      skipCount++;
      continue;
    }

    console.log(`\n${sku}: ${oldSlug.slice(0, 45)}...`);
    console.log(`  → ${newSlug}`);

    // 1. ย้ายโฟลเดอร์รูปและเปลี่ยนชื่อไฟล์
    const newImagePaths = renameImageFolder(oldSlug, newSlug);
    console.log(`  รูป: ${newImagePaths.length} webp paths`);

    // 2. อัปเดต DB
    const updateData = { slug: newSlug };
    if (newImagePaths.length > 0) {
      updateData.imageUrl = newImagePaths[0];
      updateData.images = newImagePaths;
    }
    await prisma.product.update({
      where: { id: product.id },
      data: updateData,
    });

    doneCount++;
  }

  // 3. Sync products.json จาก DB
  console.log('\n[sync] อัปเดต products.json...');
  const all = await prisma.product.findMany({
    include: { category: true },
    orderBy: { createdAt: 'asc' },
  });
  fs.writeFileSync(JSON_PATH, JSON.stringify(all, null, 2), 'utf-8');
  console.log(`  บันทึก ${all.length} สินค้า`);

  // 4. Rebuild sitemap products section
  console.log('[sitemap] อัปเดต sitemap.xml...');
  const sitemapPath = path.join(BASE, 'sitemap.xml');
  let sitemap = fs.readFileSync(sitemapPath, 'utf-8');
  const entries = all.map(x => `  <url>
    <loc>https://btmusicdrive.com/product/${x.slug}</loc>
    <lastmod>2026-05-11</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n\n');
  const before = sitemap.indexOf('  <!-- Products');
  const after  = sitemap.indexOf('\n\n  <!-- Store information -->');
  sitemap = sitemap.slice(0, before) + `  <!-- Products (${all.length} items) -->\n\n` + entries + sitemap.slice(after);
  fs.writeFileSync(sitemapPath, sitemap, 'utf-8');

  await prisma.$disconnect();

  console.log('\n' + '='.repeat(55));
  console.log(`  เสร็จ: เปลี่ยน ${doneCount} slug, ข้าม ${skipCount}`);
  console.log('='.repeat(55));
}

main().catch(e => { console.error(e); process.exit(1); });
