#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const {
  r2WebKey,
  cdnWebUrl,
  planProductWebImages,
} = require('./lib/r2-web-images');

const ROOT = path.resolve(__dirname, '..');

assert.strictEqual(
  r2WebKey('/images/products/demo/demo-1.webp'),
  'web/products/demo/demo-1.webp',
);
assert.strictEqual(
  cdnWebUrl('/images/products/demo/demo-1.webp'),
  'https://img.btmusicdrive.com/web/products/demo/demo-1.webp',
);
assert.strictEqual(
  cdnWebUrl('https://img.btmusicdrive.com/web/products/demo/demo-1.webp'),
  'https://img.btmusicdrive.com/web/products/demo/demo-1.webp',
);

const product = {
  slug: 'usb-mp3-3cha-peuachiwit-cover',
  imageUrl: '/images/products/usb-mp3-3cha-peuachiwit-cover/usb-mp3-3cha-peuachiwit-cover-1.webp',
  images: [
    '/images/products/usb-mp3-3cha-peuachiwit-cover/usb-mp3-3cha-peuachiwit-cover-1.webp',
    '/images/products/usb-mp3-3cha-peuachiwit-cover/usb-mp3-3cha-peuachiwit-cover-2.webp',
  ],
};
const plan = planProductWebImages(product, ROOT);
assert.strictEqual(plan.product.imageUrl, 'https://img.btmusicdrive.com/web/products/usb-mp3-3cha-peuachiwit-cover/usb-mp3-3cha-peuachiwit-cover-1.webp');
assert.strictEqual(plan.product.images.length, 2);
assert.ok(plan.uploads.some(item => item.key.endsWith('-1.webp')));
assert.ok(plan.uploads.some(item => item.key.endsWith('-1.avif')));
assert.ok(plan.uploads.every(item => item.key.startsWith('web/products/')));
assert.ok(plan.uploads.every(item => !item.key.startsWith('originals/')));

assert.throws(
  () => planProductWebImages({ slug: 'missing', imageUrl: '/images/products/missing/missing-1.webp', images: [] }, ROOT),
  /ไม่พบไฟล์รูปเว็บ/,
);

console.log('R2 web image migration tests passed.');
