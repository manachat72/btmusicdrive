#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
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
assert.match(plan.product.imageUrl, /\/usb-mp3-3cha-peuachiwit-cover-1-[a-f0-9]{8}\.webp$/);
assert.strictEqual(plan.product.images.length, 2);
assert.ok(plan.uploads.some(item => /-1-[a-f0-9]{8}\.webp$/.test(item.key)));
assert.ok(plan.uploads.some(item => /-1-[a-f0-9]{8}\.avif$/.test(item.key)));
assert.ok(plan.uploads.every(item => item.key.startsWith('web/products/')));
assert.ok(plan.uploads.every(item => !item.key.startsWith('originals/')));

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-web-hash-'));
const tempDir = path.join(tempRoot, 'images', 'products', 'demo');
fs.mkdirSync(tempDir, { recursive: true });
fs.writeFileSync(path.join(tempDir, 'demo-1.webp'), 'first-webp');
fs.writeFileSync(path.join(tempDir, 'demo-1.avif'), 'first-avif');
const tempProduct = {
  slug: 'demo',
  imageUrl: '/images/products/demo/demo-1.webp',
  images: ['/images/products/demo/demo-1.webp'],
};
const firstPlan = planProductWebImages(tempProduct, tempRoot);
fs.writeFileSync(path.join(tempDir, 'demo-1.webp'), 'changed-webp');
fs.writeFileSync(path.join(tempDir, 'demo-1.avif'), 'changed-avif');
const changedPlan = planProductWebImages(tempProduct, tempRoot);
assert.notStrictEqual(changedPlan.product.imageUrl, firstPlan.product.imageUrl,
  'Changing an image must produce a new CDN URL so immutable caches cannot serve the old file');
assert.ok(firstPlan.uploads.every(item => item.skipIfExists), 'Content-addressed files may safely skip an existing identical key');
fs.rmSync(tempRoot, { recursive: true, force: true });

assert.throws(
  () => planProductWebImages({ slug: 'missing', imageUrl: '/images/products/missing/missing-1.webp', images: [] }, ROOT),
  /ไม่พบไฟล์รูปเว็บ/,
);

console.log('R2 web image migration tests passed.');
