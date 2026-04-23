// Inlines top 8 products from products.json into index.html
// so the LCP products-grid renders immediately without waiting for /api/products.
// script.js replaces this with fresh API data once it arrives.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PRODUCTS_JSON = path.join(ROOT, 'products.json');
const INDEX_HTML = path.join(ROOT, 'index.html');
const TOP_N = 8;

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function renderCard(product, index) {
  const rating = product.rating || 0;
  const reviews = product.reviews || 0;
  let starsHtml = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating))
      starsHtml += `<i class="ph-fill ph-star text-yellow-400 text-sm"></i>`;
    else if (i === Math.ceil(rating) && !Number.isInteger(rating))
      starsHtml += `<i class="ph-fill ph-star-half text-yellow-400 text-sm"></i>`;
    else starsHtml += `<i class="ph ph-star text-gray-300 text-sm"></i>`;
  }

  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  const discPct = hasDiscount ? Math.round((1 - product.price / product.originalPrice) * 100) : 0;
  const badgeHtml = hasDiscount
    ? `<span class="absolute top-2 left-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold shadow-sm">-${discPct}%</span>`
    : product.badge
    ? `<span class="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold text-gray-900 shadow-sm">${escapeHtml(product.badge)}</span>`
    : '';

  const lowStockHtml =
    product.stock > 0 && product.stock <= 5
      ? `<div class="text-xs font-bold text-red-500 flex items-center gap-1 mt-1.5"><i class="ph ph-warning"></i> เหลือ ${product.stock} ชิ้น!</div>`
      : '';

  const fmtP = (p) => `฿${Math.round(p).toLocaleString('th-TH')}`;
  const origHtml = hasDiscount
    ? `<span class="text-[10px] sm:text-xs price-original-muted">${fmtP(product.originalPrice)}</span>`
    : '';
  const currentPriceClass = hasDiscount ? 'price-current-sale' : 'price-current-neutral';

  const pUrl = product.slug
    ? `/product/${product.slug}`
    : `/product?id=${encodeURIComponent(product.id)}`;

  const categoryName =
    (product.category && product.category.name) || product.category || '';

  // First 2 images eager for LCP, rest lazy
  const loading = index < 2 ? 'eager' : 'lazy';
  const fetchPri = index === 0 ? ' fetchpriority="high"' : '';

  return `<div class="bg-white rounded-2xl overflow-hidden product-card border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.07)] hover:shadow-[0_12px_36px_rgba(139,115,85,0.18)]">
  <a href="${pUrl}" class="block relative aspect-square overflow-hidden group cursor-pointer">
    <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="${loading}" decoding="async"${fetchPri} width="400" height="400">
    ${badgeHtml}
    <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
  </a>
  <div class="p-2.5 sm:p-4">
    <div class="text-[10px] sm:text-xs text-gray-400 font-medium mb-0.5 uppercase tracking-wider">${escapeHtml(categoryName)}</div>
    <a href="${pUrl}" class="block"><h3 class="text-xs sm:text-sm font-bold text-gray-900 mb-1 line-clamp-2 hover:text-primary transition-colors leading-snug">${escapeHtml(product.name)}</h3></a>
    <div class="hidden sm:flex items-center mb-2">
      <div class="flex mr-1">${starsHtml}</div>
      <span class="text-xs text-gray-400">(${reviews})</span>
    </div>
    <div class="flex items-center justify-between gap-2 mb-2">
      <div class="flex items-baseline gap-1.5 flex-wrap">
        <span class="text-sm sm:text-base font-extrabold ${currentPriceClass}">${fmtP(product.price)}</span>
        ${origHtml}
      </div>
      <button class="add-to-cart-btn bg-white border border-red-500 hover:bg-red-50 active:scale-95 text-red-500 hover:text-red-600 font-bold rounded-lg w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-base sm:text-lg leading-none transition-all flex-shrink-0" data-id="${escapeHtml(product.id)}" onclick="event.preventDefault();event.stopPropagation();" aria-label="เพิ่มลงตะกร้า">+</button>
    </div>
    ${lowStockHtml}
  </div>
</div>`;
}

const products = JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf8'));
const top = products.slice(0, TOP_N);
const cardsHtml = top.map(renderCard).join('\n');

let html = fs.readFileSync(INDEX_HTML, 'utf8');
const START = '<!-- INLINE_PRODUCTS_START -->';
const END = '<!-- INLINE_PRODUCTS_END -->';

const re = new RegExp(`${START}[\\s\\S]*?${END}`);
if (!re.test(html)) {
  console.error('Markers not found in index.html');
  process.exit(1);
}

html = html.replace(re, `${START}\n${cardsHtml}\n                <!-- INLINE_PRODUCTS_END -->`);
fs.writeFileSync(INDEX_HTML, html);
console.log(`Inlined ${top.length} products into index.html`);
