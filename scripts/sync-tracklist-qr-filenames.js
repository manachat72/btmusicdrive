#!/usr/bin/env node
/**
 * เปลี่ยนชื่อไฟล์ QR ให้ตามชื่อโฟลเดอร์สินค้าจริงบน NAS โดยไม่สร้าง QR
 * หรืออัปโหลด R2 ใหม่: URL/เนื้อหา QR ที่พิมพ์ไปแล้วยังคงเดิมทั้งหมด.
 *
 * Usage: node scripts/sync-tracklist-qr-filenames.js [--apply]
 */
const fs = require('fs');
const path = require('path');
const {
  QR_DIR, QR_REG, loadQrReg, saveQrReg, nasFolderForSku, qrFileName,
} = require('./lib/tracklist-qr');

const APPLY = process.argv.includes('--apply');
const registry = loadQrReg();
let renamed = 0;
let skipped = 0;

const next = registry.map((item) => {
  const code = (String(item.url || '').match(/tracklist-([^/.]+)\.html/) || [])[1]
    || (String(item.file || '').match(/^qr-tracklist-([^ ]+)/) || [])[1]
    || (String(item.file || '').match(/\[QR-([^\]]+)\]\.png$/) || [])[1];
  if (!code || !item.productSku) return item;

  const folder = nasFolderForSku(item.productSku);
  if (!folder) {
    skipped += 1;
    console.log(`? ${code.padEnd(8)} ${item.productSku.padEnd(13)} ไม่พบโฟลเดอร์ NAS`);
    return item;
  }

  const file = qrFileName(code, item.name, item.productSku);
  if (file === item.file) {
    console.log(`= ${code.padEnd(8)} ${folder}`);
    return item;
  }

  const source = path.join(QR_DIR, item.file);
  const destination = path.join(QR_DIR, file);
  if (!fs.existsSync(source)) {
    skipped += 1;
    console.log(`? ${code.padEnd(8)} ไม่มีไฟล์ต้นทาง: ${item.file}`);
    return item;
  }
  if (fs.existsSync(destination)) {
    throw new Error(`ชื่อปลายทางซ้ำ: ${file}`);
  }

  console.log(`> ${code.padEnd(8)} ${folder}`);
  renamed += 1;
  if (APPLY) fs.renameSync(source, destination);
  return { ...item, file };
});

console.log(`\n${renamed} ไฟล์ต้องเปลี่ยนชื่อ${skipped ? ` · ข้าม ${skipped} รายการ` : ''}`);
if (APPLY) {
  saveQrReg(next);
  console.log(`บันทึก ${path.relative(process.cwd(), QR_REG)}`);
} else {
  console.log('dry run — ใส่ --apply เพื่อเปลี่ยนชื่อและอัปเดต registry');
}
