const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_URL = 'https://btmusicdrive.com';
const PUBLIC_ROOT_PAGES = [
  'index.html', 'shop.html', 'category.html', 'product.html', 'about.html',
  'contact.html', 'faq.html', 'shipping.html', 'track-order.html', 'terms.html',
  'privacy.html', 'refund.html', 'returns.html', 'exchange.html', 'warranty.html',
  'blog.html',
];
const BLOG_PAGES = fs.readdirSync(path.join(ROOT, 'blog'))
  .filter(file => file.endsWith('.html'))
  .map(file => path.join('blog', file));
const PUBLIC_PAGES = [...PUBLIC_ROOT_PAGES, ...BLOG_PAGES];
const errors = [];

function fail(file, message) {
  errors.push(`${file}: ${message}`);
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match ? match[2].trim() : '';
}

function findMeta(html, key, value) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const tag = tags.find(candidate => attr(candidate, key).toLowerCase() === value.toLowerCase());
  return tag ? attr(tag, 'content') : '';
}

function findCanonical(html) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  const tag = tags.find(candidate => attr(candidate, 'rel').toLowerCase() === 'canonical');
  return tag ? attr(tag, 'href') : '';
}

for (const relativePath of PUBLIC_PAGES) {
  const fullPath = path.join(ROOT, relativePath);
  const html = fs.readFileSync(fullPath, 'utf8');
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
  const description = findMeta(html, 'name', 'description');
  const robots = findMeta(html, 'name', 'robots');
  const canonical = findCanonical(html);
  const h1Count = (html.match(/<h1\b/gi) || []).length;

  if (!title) fail(relativePath, 'missing title');
  if (title && (title.length < 20 || title.length > 65)) {
    fail(relativePath, `title length ${title.length}; expected 20-65`);
  }
  if (!description) fail(relativePath, 'missing meta description');
  if (description && (description.length < 80 || description.length > 165)) {
    fail(relativePath, `meta description length ${description.length}; expected 80-165`);
  }
  if (!robots || /noindex/i.test(robots)) fail(relativePath, 'public page must be indexable');
  if (!canonical || !canonical.startsWith(SITE_URL)) fail(relativePath, 'missing absolute canonical URL');
  if (/\.html(?:$|[?#])/.test(canonical)) fail(relativePath, 'canonical URL must use the clean route');
  if (h1Count !== 1) fail(relativePath, `expected exactly one h1, found ${h1Count}`);

  for (const [key, value] of [
    ['property', 'og:title'], ['property', 'og:description'], ['property', 'og:image'],
    ['name', 'twitter:card'], ['name', 'twitter:title'], ['name', 'twitter:description'],
    ['name', 'twitter:image'],
  ]) {
    if (!findMeta(html, key, value)) fail(relativePath, `missing ${value}`);
  }

  const jsonLdPattern = /<script\b[^>]*type\s*=\s*(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdPattern.exec(html))) {
    const body = match[2].trim();
    if (!body || (!body.startsWith('{') && !body.startsWith('['))) continue;
    try {
      JSON.parse(body);
    } catch (error) {
      fail(relativePath, `invalid static JSON-LD: ${error.message}`);
    }
  }
}

const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));
const categories = JSON.parse(fs.readFileSync(path.join(ROOT, 'categories.json'), 'utf8'));
for (const [label, rows] of [['product', products], ['category', categories]]) {
  const seen = new Set();
  for (const row of rows) {
    if (!row.slug) {
      fail(`${label}s.json`, `${label} ${row.id || '(unknown)'} is missing slug`);
      continue;
    }
    if (seen.has(row.slug)) fail(`${label}s.json`, `duplicate slug ${row.slug}`);
    seen.add(row.slug);
  }
}

const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
if (new Set(sitemapUrls).size !== sitemapUrls.length) fail('sitemap.xml', 'contains duplicate URLs');
for (const product of products.filter(product => product.isActive !== false)) {
  const url = `${SITE_URL}/product/${product.slug}`;
  if (!sitemapUrls.includes(url)) fail('sitemap.xml', `missing ${url}`);
}
for (const category of categories) {
  const url = `${SITE_URL}/category/${category.slug}`;
  if (!sitemapUrls.includes(url)) fail('sitemap.xml', `missing ${url}`);
}
for (const privatePath of ['admin', 'cart', 'checkout', 'orders', 'profile', 'address', 'wishlist']) {
  if (sitemapUrls.includes(`${SITE_URL}/${privatePath}`)) fail('sitemap.xml', `must not include /${privatePath}`);
}
if (!process.env.SITEMAP_LASTMOD && /<lastmod>/.test(sitemap)) {
  fail('sitemap.xml', 'lastmod must be omitted unless SITEMAP_LASTMOD is explicitly provided');
}

const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
if (!robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`)) fail('robots.txt', 'missing absolute sitemap URL');
for (const privatePath of ['cart', 'checkout', 'orders', 'profile', 'address', 'wishlist']) {
  if (new RegExp(`^Disallow:\\s*/${privatePath}/?$`, 'm').test(robots)) {
    fail('robots.txt', `must allow /${privatePath} so crawlers can read its noindex tag`);
  }
}

const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const crawlerProductRoute = vercel.routes.find(route =>
  route.src === '/product/([^/]+)' && route.dest === '/server/src/index.ts' && route.has
);
const crawlerUaPattern = crawlerProductRoute?.has?.[0]?.value || '';
if (!crawlerProductRoute || !crawlerUaPattern.includes('Googlebot') || !crawlerUaPattern.includes('bingbot')) {
  fail('vercel.json', 'product pages must be server-rendered for Googlebot and bingbot');
}
const crawlerRenderer = fs.readFileSync(path.join(ROOT, 'server', 'src', 'lib', 'socialOg.ts'), 'utf8');
if (!/Googlebot/.test(crawlerRenderer) || !/bingbot/.test(crawlerRenderer)) {
  fail('server/src/lib/socialOg.ts', 'crawler detector must accept Googlebot and bingbot');
}
if (!/BreadcrumbList/.test(crawlerRenderer)) {
  fail('server/src/lib/socialOg.ts', 'bot-rendered product page must include BreadcrumbList JSON-LD');
}
const generatedProductHtml = fs.readFileSync(path.join(ROOT, 'product.html'), 'utf8');
if (!generatedProductHtml.includes('document.title=title')) {
  fail('product.html', 'inline product map must set a product-specific title synchronously');
}

if (errors.length) {
  console.error(`SEO checks failed (${errors.length}):`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`SEO checks passed: ${PUBLIC_PAGES.length} public pages, ${products.length} products, ${categories.length} categories, ${sitemapUrls.length} sitemap URLs.`);
