const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_URL = (process.env.SITEMAP_SITE_URL || 'https://btmusicdrive.com').replace(/\/+$/, '');
const LASTMOD = process.env.SITEMAP_LASTMOD || new Date().toISOString().slice(0, 10);

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, fileName), 'utf8'));
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(pathname, changefreq, priority) {
  const normalizedPath = pathname === '/' ? '/' : `/${String(pathname).replace(/^\/+/, '').replace(/\/+$/, '')}`;
  return [
    '  <url>',
    `    <loc>${xmlEscape(`${SITE_URL}${normalizedPath === '/' ? '/' : normalizedPath}`)}</loc>`,
    `    <lastmod>${LASTMOD}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n');
}

const products = readJson('products.json')
  .filter(product => product && product.isActive !== false)
  .map(product => product.slug || product.id)
  .filter(Boolean);

const categories = readJson('categories.json')
  .map(category => category && (category.slug || category.id))
  .filter(Boolean);

const blogDir = path.join(ROOT, 'blog');
const blogSlugs = fs.existsSync(blogDir)
  ? fs.readdirSync(blogDir).filter(f => f.endsWith('.html')).map(f => f.replace(/\.html$/, ''))
  : [];

const entries = [
  '  <!-- Core pages -->',
  urlEntry('/', 'daily', '1.0'),
  urlEntry('/shop', 'daily', '0.9'),
  '  <!-- Categories -->',
  ...categories.map(slug => urlEntry(`/category/${slug}`, 'weekly', '0.8')),
  '  <!-- Products -->',
  ...products.map(slug => urlEntry(`/product/${slug}`, 'weekly', '0.8')),
  '  <!-- Store information -->',
  urlEntry('/about', 'monthly', '0.7'),
  urlEntry('/contact', 'monthly', '0.7'),
  urlEntry('/shipping', 'monthly', '0.7'),
  urlEntry('/faq', 'monthly', '0.7'),
  urlEntry('/track-order', 'monthly', '0.5'),
  '  <!-- Policies -->',
  urlEntry('/terms', 'yearly', '0.4'),
  urlEntry('/privacy', 'yearly', '0.4'),
  urlEntry('/refund', 'yearly', '0.4'),
  urlEntry('/returns', 'yearly', '0.4'),
  urlEntry('/exchange', 'yearly', '0.4'),
  urlEntry('/warranty', 'yearly', '0.4'),
  '  <!-- Blog -->',
  ...(blogSlugs.length ? [urlEntry('/blog', 'weekly', '0.6')] : []),
  ...blogSlugs.map(slug => urlEntry(`/blog/${slug}`, 'monthly', '0.6')),
];

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  '',
  entries.join('\n\n'),
  '',
  '</urlset>',
  '',
].join('\n');

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
console.log(`sitemap.xml: ${entries.filter(entry => entry.startsWith('  <url>')).length} URLs`);
