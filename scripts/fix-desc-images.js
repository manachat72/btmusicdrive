// One-off: replace missing desc/desc-N.webp images in product description
// with the real product images that exist in the same folder.
// Usage: node scripts/fix-desc-images.js [--apply]
const path = require('path');
const fs = require('fs');
require(path.join(__dirname, '..', 'server', 'node_modules', 'dotenv')).config({
  path: path.join(__dirname, '..', 'server', '.env.local'),
});
const { PrismaClient } = require(path.join(__dirname, '..', 'server', 'node_modules', '@prisma', 'client'));

const PRODUCT_ID = '9a22a4cd-c4e0-4338-9b29-305599254120';
const BASE = '/images/products/usb-mp3-100-million-views';
const MAP = {
  'desc-1.webp': `${BASE}/usb-mp3-100-million-views.png`,
  'desc-2.webp': `${BASE}/usb-mp3-100-million-views1.png`,
  'desc-3.webp': `${BASE}/usb-mp3-100-million-views3.png`,
  'desc-4.webp': `${BASE}/usb-mp3-100-million-views4.png`,
};

function fix(description) {
  let out = description;
  for (const [file, replacement] of Object.entries(MAP)) {
    out = out.split(`${BASE}/desc/${file}`).join(replacement);
  }
  return out;
}

(async () => {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  const product = await prisma.product.findUnique({ where: { id: PRODUCT_ID } });
  if (!product) throw new Error('product not found');

  const next = fix(product.description || '');
  const changed = next !== product.description;
  console.log(`[db] changed: ${changed}`);
  console.log((next.match(/<img[^>]*>/gi) || []).join('\n'));

  if (apply && changed) {
    await prisma.product.update({ where: { id: PRODUCT_ID }, data: { description: next } });
    console.log('[db] updated');
  }
  await prisma.$disconnect();

  // products.json
  const jsonPath = path.join(__dirname, '..', 'products.json');
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(raw);
  const list = Array.isArray(data) ? data : data.data;
  const p = list.find((x) => x.id === PRODUCT_ID);
  if (!p) throw new Error('product not in products.json');
  const nextJson = fix(p.description || '');
  console.log(`[json] changed: ${nextJson !== p.description}`);
  if (apply && nextJson !== p.description) {
    p.description = nextJson;
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log('[json] updated');
  }
  if (!apply) console.log('\nDRY RUN — rerun with --apply to write');
})();
