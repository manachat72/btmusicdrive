'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { imageSlugFromUrl } = require('./lib/product-image-path');
const { previewNasImages } = require('./lib/nas-image-selection');

const root = path.resolve(__dirname, '..');
const studioSource = fs.readFileSync(path.join(root, 'scripts', 'listing-studio.js'), 'utf8');
const resyncSource = fs.readFileSync(path.join(root, 'scripts', 'resync-product-images.js'), 'utf8');

assert.strictEqual(
  imageSlugFromUrl('/images/products/old-product/old-product-1.webp'),
  'old-product',
  'Local web image URLs should resolve to their product folder'
);
assert.strictEqual(
  imageSlugFromUrl('https://img.btmusicdrive.com/web/products/r2-product/r2-product-1.webp'),
  'r2-product',
  'R2 web image URLs should resolve to their product folder, not "web"'
);
assert.strictEqual(
  imageSlugFromUrl('https://img.btmusicdrive.com/images/products/cdn-product/cdn-product-1.webp'),
  'cdn-product',
  'CDN image URLs with the legacy images prefix should resolve correctly'
);
assert.strictEqual(imageSlugFromUrl('https://example.com/not-a-product.jpg'), '', 'Unknown URLs should not guess a folder');

const tempNas = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-nas-selection-'));
const folder = '09-demo';
fs.mkdirSync(path.join(tempNas, folder));
['1.jpg', '2.1.jpg', '2.2.jpg', '2.jpg', '3.jpg', '4.jpg', 'หลัก_01.jpg', 'หลัก_02.jpg', 'หลัก_05.jpg', 'หลัก_06.jpg']
  .forEach((name) => fs.writeFileSync(path.join(tempNas, folder, name), name));
fs.writeFileSync(path.join(tempNas, folder, 'รายชื่อเพลง.txt'), 'ignore');
const preview = previewNasImages(tempNas, folder);
assert.strictEqual(preview.total, 10);
assert.deepStrictEqual(preview.files, [
  '1.jpg', '2.1.jpg', '2.2.jpg', '2.jpg', '3.jpg', '4.jpg', 'หลัก_01.jpg', 'หลัก_02.jpg', 'หลัก_05.jpg',
]);
assert.throws(() => previewNasImages(tempNas, '../outside'), /ชื่อโฟลเดอร์ไม่ถูกต้อง/);
fs.rmSync(tempNas, { recursive: true, force: true });

assert.doesNotMatch(studioSource, /createNasImageWatcher\(/,
  'Changing NAS files must not publish before the user presses the explicit button');
assert.match(studioSource, /url\.pathname === '\/api\/nas-preview'/,
  'Product Studio should expose the exact first-nine NAS preview');
assert.match(studioSource, /url\.pathname === '\/api\/replace-images-from-nas'/,
  'Product Studio should expose an explicit NAS-to-web action');
assert.match(studioSource, /const verified = await api\(`\/products\/\$\{product\.id\}`\)/,
  'NAS publication must read the product back from the API');
assert.match(studioSource, /String\(verified\.imageUrl \|\| ''\)\.split\('\?'\)\[0\] !== img\.web\[0\]/,
  'NAS publication must verify the exact new image URL');
assert.match(studioSource, /processProductImages\(\{[\s\S]*srcDir[\s\S]*prune: true/,
  'The selected NAS folder must rebuild all image layers from its first nine images');
assert.match(studioSource, /assertCodeFree\(outputCode, product\.imgSlug, product\.name\)/,
  'Marketplace overwrite protection must use the destination code, not the NAS source-folder number');
assert.match(studioSource, /code: outputCode, slug: product\.imgSlug/,
  'NAS source folders and marketplace destination codes may have different numbers');
assert.doesNotMatch(studioSource, /folderCode !== (expectedCode|outputCode)/,
  'A NAS source-folder number must not be required to match the marketplace destination code');
assert.doesNotMatch(resyncSource, /imageUrl \|\| ''\)\.split\('\/'\)\[3\]/,
  'The manual recovery script must not use the broken fixed-position URL parser');
assert.match(resyncSource, /const FOLDER = argVal\('--folder', ''\)/,
  'The recovery script must support a NAS source folder whose number differs from the destination code');

console.log('Product Studio NAS image path contract passed.');
