// scripts/inline-product-jsonld.js
// Inlines a compact product map into product.html so the page can inject
// Product + BreadcrumbList JSON-LD synchronously in <head> before JS loads.
const fs = require('fs');
const path = require('path');

const products = require('../products.json');

function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(str, max) {
  str = str.trim();
  return str.length <= max ? str : str.slice(0, max).trim() + '…';
}

const map = {};
for (const p of products) {
  if (!p.slug) continue;
  map[p.slug] = {
    n: p.name,
    p: Number(p.price),
    s: Number(p.stock),
    i: p.imageUrl || '',
    d: truncate(stripHtml(p.description), 155)
  };
}

const inlineCode = `<script>window.__PMAP__=${JSON.stringify(map)};</script>`;

const htmlPath = path.join(__dirname, '..', 'product.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const START = '<!-- INLINE_PRODUCT_MAP_START -->';
const END = '<!-- INLINE_PRODUCT_MAP_END -->';

const si = html.indexOf(START);
const ei = html.indexOf(END);

if (si === -1 || ei === -1) {
  console.error('Markers INLINE_PRODUCT_MAP_START / END not found in product.html');
  process.exit(1);
}

html = html.slice(0, si + START.length) + '\n' + inlineCode + '\n' + html.slice(ei);
fs.writeFileSync(htmlPath, html, 'utf8');

const kb = (JSON.stringify(map).length / 1024).toFixed(1);
console.log(`Inlined product map: ${Object.keys(map).length} products, ${kb}KB`);
