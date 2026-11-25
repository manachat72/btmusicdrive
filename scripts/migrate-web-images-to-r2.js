#!/usr/bin/env node
'use strict';

/**
 * ย้ายรูปย่อสำหรับเว็บจาก images/products/ ขึ้น Cloudflare R2
 *
 * - อัปเฉพาะ WebP/AVIF ไปที่ web/products/<slug>/
 * - ไม่อ่าน ไม่แก้ และไม่ลบ originals/ หรือไฟล์ต้นฉบับบน Z:\photos\Product
 * - dry-run เป็นค่าเริ่มต้น; ใส่ --apply จึงอัปจริงและแก้ products.json
 */
const fs = require('fs');
const path = require('path');
const r2 = require('./lib/r2');
const { planProductWebImages } = require('./lib/r2-web-images');

const ROOT = path.resolve(__dirname, '..');
const PRODUCTS_FILE = path.join(ROOT, 'products.json');
const APPLY = process.argv.includes('--apply');

async function main() {
  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  const migrated = [];
  const uploads = new Map();
  const errors = [];

  for (const product of products) {
    try {
      const plan = planProductWebImages(product, ROOT);
      migrated.push(plan.product);
      for (const item of plan.uploads) uploads.set(item.key, item);
    } catch (error) {
      errors.push(`${product.slug || product.id}: ${error.message}`);
      migrated.push(product);
    }
  }

  const totalBytes = [...uploads.values()].reduce((sum, item) => sum + item.body.length, 0);
  console.log(`สินค้า         : ${products.length}`);
  console.log(`สินค้าแปลง URL : ${migrated.filter(p => String(p.imageUrl || '').startsWith(`${r2.CDN}/web/products/`)).length}`);
  console.log(`ไฟล์ WebP/AVIF : ${uploads.size}`);
  console.log(`ขนาดอัปโหลด    : ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log('ต้นฉบับ        : ไม่แตะ Z:\\photos\\Product และ R2/originals/');

  if (errors.length) {
    console.error('\n✖ พบสินค้าที่เตรียมรูปไม่ได้:');
    errors.forEach(message => console.error(`  - ${message}`));
    throw new Error(`หยุดก่อนอัปโหลด เพราะมีข้อผิดพลาด ${errors.length} รายการ`);
  }

  if (!APPLY) {
    console.log('\nDRY RUN — ยังไม่อัปโหลดและยังไม่แก้ products.json');
    console.log('รัน node scripts/migrate-web-images-to-r2.js --apply เพื่อทำจริง');
    return;
  }

  let done = 0;
  await r2.putMany([...uploads.values()], {
    // R2/S3 connection on this Windows host is more stable with a small queue.
    concurrency: 2,
    onProgress: (current, total) => {
      done = current;
      if (current === total || current % 50 === 0) console.log(`  อัปโหลด ${current}/${total}`);
    },
  });
  if (done !== uploads.size) throw new Error(`อัปโหลดไม่ครบ: ${done}/${uploads.size}`);

  fs.writeFileSync(PRODUCTS_FILE, `${JSON.stringify(migrated, null, 2)}\n`, 'utf8');
  console.log(`\n✔ อัปโหลดครบ ${done} ไฟล์`);
  console.log('✔ products.json ใช้ https://img.btmusicdrive.com/web/products/... แล้ว');
}

main().catch(error => {
  console.error(`✖ ${error.message}`);
  process.exit(1);
});
