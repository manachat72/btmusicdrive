'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { imageSlugFromUrl } = require('./lib/product-image-path');

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

assert.match(studioSource, /createNasImageWatcher\(/,
  'Product Studio should watch linked NAS folders automatically');
assert.match(studioSource, /async function publishNasFolderUpdate\(/,
  'Product Studio needs one complete NAS-to-web publish transaction');
assert.match(studioSource, /const verified = await api\(`\/products\/\$\{product\.id\}`\)/,
  'Automatic publication must read the product back from the API');
assert.match(studioSource, /String\(verified\.imageUrl \|\| ''\)\.split\('\?'\)\[0\] !== img\.web\[0\]/,
  'Automatic publication must verify the exact new image URL');
assert.doesNotMatch(resyncSource, /imageUrl \|\| ''\)\.split\('\/'\)\[3\]/,
  'The manual recovery script must not use the broken fixed-position URL parser');

console.log('Product Studio NAS image path contract passed.');
