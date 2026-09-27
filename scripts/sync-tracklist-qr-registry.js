#!/usr/bin/env node
/**
 * เติมข้อมูลอ้างอิงสินค้าปัจจุบันให้คลัง QR โดยไม่สร้าง QR ใหม่หรือเปลี่ยน URL เดิม
 *
 * QR ที่พิมพ์แล้วผูกกับ legacy code (tracklist-<code>.html) จึงต้องคงเลขนั้นไว้
 * ส่วน productSku / productSlug ช่วยให้ Studio แสดงชื่อและเลขชุด NAS ปัจจุบันได้ถูกต้อง
 *
 * Usage: node scripts/sync-tracklist-qr-registry.js [--apply]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'qr', 'qr-registry.json');
const PRODUCTS = path.join(ROOT, 'products.json');
const CATALOG = path.join(ROOT, 'marketplace-images', 'catalog.json');
const APPLY = process.argv.includes('--apply');

const normalize = (value) => String(value || '')
  .toLocaleLowerCase('th')
  .replace(/usb|flash\s*drive|แฟลชไดรฟ์|แฟลชไดร์ฟ|พร้อมเพลง|mp3/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, '');

function similarity(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9 + (0.1 * Math.min(left.length, right.length) / Math.max(left.length, right.length));
  const grams = (text) => {
    const found = new Map();
    for (let index = 0; index < text.length - 1; index += 1) {
      const gram = text.slice(index, index + 2);
      found.set(gram, (found.get(gram) || 0) + 1);
    }
    return found;
  };
  const a = grams(left);
  const b = grams(right);
  let shared = 0;
  for (const [gram, count] of a) shared += Math.min(count, b.get(gram) || 0);
  const total = [...a.values(), ...b.values()].reduce((sum, count) => sum + count, 0);
  return total ? (2 * shared) / total : 0;
}

function qrCode(item) {
  const fromFile = String(item.file || '').match(/^qr-tracklist-([^ ]+)/);
  const fromUrl = String(item.url || '').match(/tracklist-([^/.]+)\.html/);
  return (fromFile || fromUrl || [])[1] || null;
}


const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
const products = JSON.parse(fs.readFileSync(PRODUCTS, 'utf8'))
  .filter((product) => Array.isArray(product.tracklist) && product.tracklist.length);
const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8')).products || [];
let updated = 0;
let unmatched = 0;

function bestProduct(referenceName) {
  let product = null;
  let score = 0;
  for (const candidate of products) {
    const candidateScore = similarity(normalize(referenceName), normalize(candidate.name));
    if (candidateScore > score) {
      score = candidateScore;
      product = candidate;
    }
  }
  return { product, score };
}

const synced = registry.map((item) => {
  const code = qrCode(item);
  if (!code) return item;
  const label = String(item.name || '').replace(/^[^ ]+\s+รายชื่อเพลง\s+[—-]\s*/u, '');
  // Numeric QR codes are the legacy marketplace codes.  Their catalog title is
  // a safer source than the shortened registry label, which may be stale.
  const catalogItem = /^\d+$/.test(code)
    ? catalog.find((entry) => String(entry.code).padStart(2, '0') === code.padStart(2, '0'))
    : null;
  const fromCatalog = catalogItem ? bestProduct(catalogItem.title) : null;
  const fromLabel = bestProduct(label);
  // Prefer the legacy-code catalog when it gives a clear match; otherwise the
  // existing label is a better clue for old catalog titles that were shortened.
  const chosen = fromCatalog && fromCatalog.score >= 0.5 ? fromCatalog : fromLabel;
  const winner = chosen.product;
  const best = chosen.score;
  // A numeric code has an authoritative entry in catalog.json, so preserve its
  // mapping even when a longer marketplace title makes text similarity low.
  // For the old xSKU aliases, retain the conservative matching threshold.
  const isTrustedCatalogCode = Boolean(catalogItem && fromCatalog.score >= 0.5);
  if (!winner || (!isTrustedCatalogCode && best < 0.4)) {
    unmatched += 1;
    console.log(`? ${code}  ไม่พบสินค้าที่จับคู่ได้อย่างมั่นใจ (${best.toFixed(2)})`);
    return item;
  }
  const next = {
    ...item,
    name: `${code} รายชื่อเพลง — ${winner.name.slice(0, 45)}`,
    productSku: winner.sku || '',
    productSlug: winner.slug || '',
  };
  if (next.name !== item.name || next.productSku !== item.productSku || next.productSlug !== item.productSlug) updated += 1;
  console.log(`${code.padEnd(8)} ${next.productSku.padEnd(13)} ${best.toFixed(2)}  ${winner.name.slice(0, 65)}`);
  return next;
});

console.log(`\n${updated} รายการต้องอัปเดต${unmatched ? ` · ${unmatched} รายการไม่แตะ` : ''}`);
if (APPLY) {
  fs.writeFileSync(REGISTRY, `${JSON.stringify(synced, null, 2)}\n`, 'utf8');
  console.log(`บันทึก ${path.relative(ROOT, REGISTRY)}`);
} else {
  console.log('dry run — ใส่ --apply เพื่อบันทึก');
}
