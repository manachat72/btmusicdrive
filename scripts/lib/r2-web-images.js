'use strict';

const fs = require('fs');
const path = require('path');
const r2 = require('./r2');

const CDN_WEB_PREFIX = `${r2.CDN}/web/products/`;
const LOCAL_PRODUCT_PREFIX = '/images/products/';

function normalizeRef(ref) {
  return String(ref || '').replace(/\\/g, '/');
}

function r2WebKey(ref) {
  const value = normalizeRef(ref);
  if (value.startsWith(CDN_WEB_PREFIX)) {
    return `web/products/${decodeURI(value.slice(CDN_WEB_PREFIX.length))}`;
  }
  const index = value.indexOf(LOCAL_PRODUCT_PREFIX);
  if (index === -1) throw new Error(`ไม่ใช่ URL รูปสินค้าในเว็บ: ${ref}`);
  return `web/products/${value.slice(index + LOCAL_PRODUCT_PREFIX.length)}`;
}

function cdnWebUrl(ref) {
  const value = normalizeRef(ref);
  if (value.startsWith(CDN_WEB_PREFIX)) return value;
  return r2.urlOf(r2WebKey(value));
}

function localCandidates(ref, root) {
  const value = normalizeRef(ref);
  const localPart = value.startsWith(CDN_WEB_PREFIX)
    ? `/images/products/${decodeURI(value.slice(CDN_WEB_PREFIX.length))}`
    : value.slice(value.indexOf(LOCAL_PRODUCT_PREFIX));
  const exact = path.join(root, ...localPart.replace(/^\//, '').split('/'));
  const unhashed = exact.replace(/-[0-9a-f]{8}(?=\.[^.]+$)/i, '');
  return exact === unhashed ? [exact] : [exact, unhashed];
}

function resolveLocalFile(ref, root) {
  return localCandidates(ref, root).find(file => fs.existsSync(file)) || null;
}

function planProductWebImages(product, root) {
  const refs = [...new Set([product.imageUrl, ...(Array.isArray(product.images) ? product.images : [])].filter(Boolean))];
  if (!refs.length) throw new Error(`สินค้า ${product.slug || product.id || ''} ไม่มี URL รูปเว็บ`);

  const replacements = new Map();
  const uploadsByKey = new Map();
  for (const ref of refs) {
    const target = cdnWebUrl(ref);
    replacements.set(ref, target);
    if (normalizeRef(ref).startsWith(CDN_WEB_PREFIX)) continue;

    const local = resolveLocalFile(ref, root);
    if (!local) throw new Error(`ไม่พบไฟล์รูปเว็บ: ${ref}`);
    const webpKey = r2WebKey(ref);
    uploadsByKey.set(webpKey, {
      key: webpKey,
      body: fs.readFileSync(local),
      cacheControl: 'public, max-age=31536000, immutable',
      skipIfExists: true,
    });

    if (/\.webp$/i.test(local)) {
      const avifLocal = local.replace(/\.webp$/i, '.avif');
      if (fs.existsSync(avifLocal)) {
        const avifKey = webpKey.replace(/\.webp$/i, '.avif');
        uploadsByKey.set(avifKey, {
          key: avifKey,
          body: fs.readFileSync(avifLocal),
          cacheControl: 'public, max-age=31536000, immutable',
          skipIfExists: true,
        });
      }
    }
  }

  return {
    product: {
      ...product,
      imageUrl: replacements.get(product.imageUrl) || product.imageUrl,
      images: (Array.isArray(product.images) ? product.images : []).map(ref => replacements.get(ref) || ref),
    },
    uploads: [...uploadsByKey.values()],
  };
}

async function uploadProductWebImages(product, root, options = {}) {
  const plan = planProductWebImages(product, root);
  if (plan.uploads.length) {
    await r2.putMany(plan.uploads, {
      concurrency: options.concurrency || 6,
      onProgress: options.onProgress,
    });
  }
  return plan;
}

module.exports = {
  CDN_WEB_PREFIX,
  r2WebKey,
  cdnWebUrl,
  resolveLocalFile,
  planProductWebImages,
  uploadProductWebImages,
};
