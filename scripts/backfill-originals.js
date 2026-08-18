#!/usr/bin/env node
/**
 * อัปต้นฉบับรูปสินค้าที่มีอยู่บน NAS ขึ้น R2 (originals/) — รันครั้งเดียวตอน NAS ต่ออยู่
 *
 * ทำไมต้องมี: ต้นฉบับเคยอยู่บน NAS ที่เดียว ถ้าไดรฟ์ไม่ได้ต่อหรือพัง = ทำรูปใหม่ไม่ได้เลย
 * หลังรันแล้วต้นฉบับจะอยู่ทั้ง NAS และ R2 (ข้ามไฟล์ที่อัปแล้วอัตโนมัติ)
 *
 * Usage:
 *   node scripts/backfill-originals.js                # dry-run — รายงานว่าจะอัปอะไรบ้าง
 *   node scripts/backfill-originals.js --apply        # อัปจริง (ข้ามไฟล์ที่มีแล้วบน R2)
 *   node scripts/backfill-originals.js --apply --force  # อัปทับทุกไฟล์
 *   node scripts/backfill-originals.js --apply --code 57  # เฉพาะ code เดียว
 *   เพิ่ม --src "D:\path" เพื่อเปลี่ยนต้นทาง
 */
const fs = require('fs');
const path = require('path');
const r2 = require('./lib/r2');
const { imageSlug } = require('./lib/product-slug');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const FORCE = argv.includes('--force');
const argVal = (flag, def) => { const i = argv.indexOf(flag); return i !== -1 && argv[i + 1] ? argv[i + 1] : def; };
const ONLY_CODE = argVal('--code', null);
const SRC_DIR = argVal('--src', 'Z:\\รูป\\รูปสินค้า');

const IMG_EXT = /\.(jpe?g|png|webp|avif|tiff?|bmp)$/i;
const MAX_IMAGES = 9;

function parseDirName(name) {
  const m = name.match(/^(\d+)\s*-\s*(.*)$/);
  return m ? { code: m[1].padStart(2, '0'), title: m[2].trim() } : { code: null, title: name.trim() };
}

function listImages(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(f => f.isFile() && IMG_EXT.test(f.name))
    .map(f => f.name)
    .sort((a, b) => {
      const na = parseInt((a.match(/(\d+)(?=\.[^.]+$)/) || [])[1] || '0', 10);
      const nb = parseInt((b.match(/(\d+)(?=\.[^.]+$)/) || [])[1] || '0', 10);
      return na - nb || a.localeCompare(b);
    })
    .slice(0, MAX_IMAGES);
}

(async () => {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`✖ เข้าถึงต้นทางไม่ได้: ${SRC_DIR}\n  ต่อไดรฟ์ NAS ก่อน หรือระบุ --src "D:\\path"`);
    process.exit(1);
  }

  const dirs = fs.readdirSync(SRC_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort((a, b) => a.localeCompare(b, 'th'));

  console.log(`ต้นทาง : ${SRC_DIR}`);
  console.log(`ปลายทาง: R2 originals/`);
  console.log(APPLY ? '\n=== APPLY ===\n' : '\n=== DRY RUN (ใส่ --apply เพื่ออัปจริง) ===\n');

  let totalFiles = 0, totalBytes = 0, uploaded = 0, skipped = 0;

  for (const dirName of dirs) {
    const { code, title } = parseDirName(dirName);
    if (!code) { console.log(`⚠ ข้าม "${dirName}" — ชื่อโฟลเดอร์ไม่ขึ้นต้นด้วยเลข`); continue; }
    if (ONLY_CODE && code !== String(ONLY_CODE).padStart(2, '0')) continue;

    const dir = path.join(SRC_DIR, dirName);
    const files = listImages(dir);
    if (!files.length) { console.log(`⚠ ${code} ไม่มีรูป`); continue; }

    const slug = imageSlug(title) || code;
    const prefix = `originals/${code}-${slug}`;
    const items = [];

    for (let i = 0; i < files.length; i++) {
      const ext = path.extname(files[i]).toLowerCase();
      const key = `${prefix}/${code}-orig-${String(i + 1).padStart(2, '0')}${ext}`;
      const local = path.join(dir, files[i]);
      const size = fs.statSync(local).size;
      totalFiles++; totalBytes += size;

      if (!FORCE && APPLY && await r2.exists(key)) { skipped++; continue; }
      items.push({ key, body: APPLY ? fs.readFileSync(local) : null, cacheControl: 'public, max-age=31536000, immutable' });
    }

    if (!items.length) { console.log(`✓ ${code} ${title.slice(0, 40)} — มีครบแล้ว (${files.length} ไฟล์)`); continue; }

    if (APPLY) {
      await r2.putMany(items, { concurrency: 6 });
      uploaded += items.length;
      console.log(`✔ ${code} ${title.slice(0, 40)} → ${items.length} ไฟล์ (${prefix}/)`);
    } else {
      console.log(`  ${code} ${title.slice(0, 40)} → จะอัป ${items.length} ไฟล์ (${prefix}/)`);
    }
  }

  console.log(`\nต้นฉบับทั้งหมด : ${totalFiles} ไฟล์ · ${(totalBytes / 1024 / 1024 / 1024).toFixed(2)} GB`);
  if (APPLY) console.log(`อัปขึ้น R2     : ${uploaded} ไฟล์ · ข้าม (มีแล้ว) ${skipped} ไฟล์`);
  else console.log('ยังไม่ได้อัปจริง — ใส่ --apply');
})().catch(e => { console.error('✖', e.message); process.exit(1); });
