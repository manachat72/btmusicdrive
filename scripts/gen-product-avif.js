#!/usr/bin/env node
/**
 * สร้างไฟล์ .avif เคียงข้างรูปสินค้า .webp ทุกใบใน images/products/**
 * ใช้กับ <picture> ใน inline-products.js (AVIF source + webp <img> fallback)
 *
 * Usage:
 *   node scripts/gen-product-avif.js            # gen เฉพาะ cover (-1.webp) ที่ยังไม่มี .avif
 *   node scripts/gen-product-avif.js --all      # ทุกใบ (-1, -2, ...) ที่ยังไม่มี .avif
 *   node scripts/gen-product-avif.js --force     # regen ทับของเดิมด้วย
 *
 * ไม่ resize (คง native ≤600px) — encode AVIF q50 เท่านั้น เพื่อไม่ให้คุณภาพ retina ตก
 * idempotent: ข้ามใบที่มี .avif แล้ว (เว้นแต่ --force)
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const PROD_DIR = path.join(ROOT, 'images', 'products');
const ALL = process.argv.includes('--all');
const FORCE = process.argv.includes('--force');
const AVIF_Q = 50;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.webp$/i.test(entry.name)) out.push(p);
  }
  return out;
}

async function main() {
  if (!fs.existsSync(PROD_DIR)) { console.error('images/products/ not found'); process.exit(1); }

  let webps = walk(PROD_DIR);
  if (!ALL) webps = webps.filter(p => /-1\.webp$/i.test(p));

  let made = 0, skipped = 0, before = 0, after = 0;
  for (const wf of webps) {
    const af = wf.replace(/\.webp$/i, '.avif');
    if (fs.existsSync(af) && !FORCE) { skipped++; continue; }
    try {
      const buf = fs.readFileSync(wf);
      const avif = await sharp(buf).rotate().avif({ quality: AVIF_Q, effort: 6 }).toBuffer();
      fs.writeFileSync(af, avif);
      before += fs.statSync(wf).size; after += avif.length;
      made++;
      console.log(`  OK  ${path.relative(ROOT, af)}  (${(avif.length / 1024).toFixed(1)}KB)`);
    } catch (err) {
      console.log(`  ERR ${path.relative(ROOT, wf)}: ${err.message}`);
    }
  }
  console.log(`\n  Made: ${made}  Skipped(existing): ${skipped}`);
  if (made) console.log(`  webp ${(before / 1024).toFixed(1)}KB → avif ${(after / 1024).toFixed(1)}KB (-${((1 - after / before) * 100).toFixed(0)}%)`);
}

main().catch(err => { console.error(err); process.exit(1); });
