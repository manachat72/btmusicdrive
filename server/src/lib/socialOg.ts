import { Response } from 'express';
import prisma from './prisma';

// Social scrapers และ search crawlers อาจไม่รัน JS หรือเห็น meta เริ่มต้นก่อน
// product data โหลดเสร็จ จึงต้อง render metadata ฝั่ง server ให้ /product/:slug
// (LINE ใช้ UA facebookexternalhit;line-poker)
const PREVIEW_OR_SEARCH_BOT_RE =
  /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|WhatsApp|Discordbot|Pinterestbot|SkypeUriPreview|line-poker|Googlebot|Google-InspectionTool|bingbot|DuckDuckBot|YandexBot|Baiduspider|Applebot|OAI-SearchBot|ChatGPT-User|PerplexityBot/i;

export function isSocialBot(userAgent: string | undefined): boolean {
  return !!userAgent && PREVIEW_OR_SEARCH_BOT_RE.test(userAgent);
}

const SITE_URL = 'https://btmusicdrive.com';
const FALLBACK_OG_IMAGE = `${SITE_URL}/images/og-cover.jpg`;

const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function truncateAtWord(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  const slice = normalized.slice(0, maxLength + 1);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace >= Math.floor(maxLength * 0.6)
    ? slice.slice(0, lastSpace)
    : slice.slice(0, maxLength)).trim();
}

/**
 * สร้าง <title>/og:title ให้เหมือนฝั่ง client เป๊ะ ๆ
 * (ตัวเดียวกับ window.__BTSEO_TITLE__ ใน scripts/inline-product-jsonld.js — แก้ที่ไหนต้องแก้อีกที่ด้วย)
 * เก็บคีย์เวิร์ดท้ายชื่อ (จำนวนเพลง/ความจุ/ฟังในรถ) ไว้ก่อน แล้วค่อยต่อ brand ถ้ายังมีที่เหลือ
 */
function buildSeoTitle(rawName: string): string {
  const BRAND = ' | Bt music drive';
  const MAX = 65;
  const name = String(rawName || '').replace(/\s+/g, ' ').trim();
  const clean = (v: string) => v.replace(/[\s|/,.!:;(\-–—]+$/, '').trim();

  if (name.length + BRAND.length <= MAX) return name + BRAND;

  let title = name;
  if (title.length > MAX) {
    const slice = name.slice(0, MAX + 1);
    const lastSpace = slice.lastIndexOf(' ');
    title = clean(lastSpace > 20 ? name.slice(0, lastSpace) : name.slice(0, MAX));
  } else {
    title = clean(title);
  }
  return title.length + BRAND.length <= MAX ? title + BRAND : title;
}

function absoluteImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${SITE_URL}/${imageUrl.replace(/^\/+/, '')}`;
}

// เอาไว้ทำ meta description จาก field description ที่อาจมี HTML ปนอยู่ (rich text จาก admin)
function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const MAX_TRACKLIST_PREVIEW = 30;

/**
 * Render หน้า HTML เบาๆ ที่มี OG/Twitter meta ครบสำหรับ social scraper
 * คืน true ถ้า render สำเร็จ, false ถ้าไม่พบสินค้า (ให้ caller ตอบแบบเดิมต่อ)
 */
export async function renderProductOgPage(slug: string, res: Response): Promise<boolean> {
  const product = await prisma.product.findUnique({
    where: { slug },
    select: {
      name: true,
      description: true,
      price: true,
      originalPrice: true,
      imageUrl: true,
      images: true,
      stock: true,
      slug: true,
      sku: true,
      brand: true,
      tags: true,
      tracklist: true,
      specs: true,
      category: { select: { name: true, slug: true } },
    },
  });
  if (!product) return false;

  const pageUrl = `${SITE_URL}/product/${encodeURIComponent(product.slug || slug)}`;
  const title = buildSeoTitle(product.name);
  const plainDescription = stripHtml(product.description || '');
  const descriptionSource = plainDescription
    || `${product.name} แฟลชไดร์ฟเพลง MP3 เสียบปุ๊บฟังปั๊บ ไม่ต้องใช้เน็ต จัดส่งทั่วไทย`;
  const description = truncateAtWord(descriptionSource, 155);
  const productImage = absoluteImageUrl(product.imageUrl);
  const galleryImages = (Array.isArray(product.images) ? product.images : [])
    .map((img) => absoluteImageUrl(img))
    .filter((img): img is string => !!img);
  const ogImages = [productImage, ...galleryImages, FALLBACK_OG_IMAGE]
    .filter((img, index, arr): img is string => !!img && arr.indexOf(img) === index)
    .slice(0, 6);

  const categoryName = product.category?.name || null;
  const categorySlug = product.category?.slug || null;
  const categoryUrl = categorySlug ? `${SITE_URL}/category/${categorySlug}` : `${SITE_URL}/shop`;

  const specsEntries = product.specs && typeof product.specs === 'object'
    ? Object.entries(product.specs as Record<string, unknown>)
    : [];

  const tracklist = Array.isArray(product.tracklist) ? product.tracklist : [];
  const tracklistPreview = tracklist.slice(0, MAX_TRACKLIST_PREVIEW);
  const tracklistRemaining = Math.max(0, tracklist.length - tracklistPreview.length);

  const inStock = product.stock > 0;
  const hasDiscount = !!product.originalPrice && product.originalPrice > product.price;

  // โครงเดียวกับ breadcrumb ฝั่ง client (product.html) — อย่าให้สองที่นี้ต่างกัน
  const breadcrumbItems: Array<{ '@type': string; position: number; name: string; item: string }> = [
    { '@type': 'ListItem', position: 1, name: 'หน้าหลัก', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'ร้านค้า', item: `${SITE_URL}/shop` },
  ];
  if (categoryName && categorySlug) {
    breadcrumbItems.push({ '@type': 'ListItem', position: 3, name: categoryName, item: categoryUrl });
  }
  breadcrumbItems.push({
    '@type': 'ListItem',
    position: breadcrumbItems.length + 1,
    name: product.name,
    item: pageUrl,
  });
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  };

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description,
    image: ogImages,
    url: pageUrl,
    sku: product.sku || undefined,
    brand: { '@type': 'Brand', name: product.brand || 'Bt music drive' },
    category: categoryName || undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'THB',
      price: product.price,
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: pageUrl,
    },
  };

  const specsHtml = specsEntries.length
    ? `<h2>คุณสมบัติสินค้า</h2><table><tbody>${specsEntries
        .map(([key, value]) => `<tr><th>${esc(key)}</th><td>${esc(String(value))}</td></tr>`)
        .join('')}</tbody></table>`
    : '';

  const tracklistHtml = tracklistPreview.length
    ? `<h2>รายชื่อเพลง (${tracklist.length} เพลง)</h2><ol>${tracklistPreview
        .map((track) => `<li>${esc(track)}</li>`)
        .join('')}</ol>${tracklistRemaining > 0 ? `<p>และอีก ${tracklistRemaining} เพลง ดูรายชื่อเพลงทั้งหมดได้ที่หน้าสินค้า</p>` : ''}`
    : '';

  const tagsHtml = Array.isArray(product.tags) && product.tags.length
    ? `<p>แท็ก: ${product.tags.map((t) => esc(t)).join(', ')}</p>`
    : '';

  const priceHtml = hasDiscount
    ? `<p>ราคา ${esc(product.price)} บาท (ปกติ ${esc(product.originalPrice)} บาท)</p>`
    : `<p>ราคา ${esc(product.price)} บาท</p>`;

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${esc(pageUrl)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Bt music drive">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${ogImages.map((img) => `<meta property="og:image" content="${esc(img)}">`).join('\n')}
<meta property="og:image:alt" content="${esc(product.name)}">
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:locale" content="th_TH">
<meta property="product:price:amount" content="${esc(product.price)}">
<meta property="product:price:currency" content="THB">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(ogImages[0])}">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
</head>
<body>
<nav>
<a href="${esc(SITE_URL)}/">หน้าหลัก</a> &raquo;
<a href="${esc(SITE_URL)}/shop">ร้านค้า</a>${categoryName && categorySlug ? ` &raquo; <a href="${esc(categoryUrl)}">${esc(categoryName)}</a>` : ''} &raquo;
<span>${esc(product.name)}</span>
</nav>
<h1>${esc(product.name)}</h1>
${priceHtml}
<p>สถานะสินค้า: ${inStock ? 'มีสินค้า พร้อมส่ง' : 'สินค้าหมดชั่วคราว'}</p>
<p>${esc(plainDescription || description)}</p>
${tagsHtml}
${specsHtml}
${tracklistHtml}
<p>รับประกันสินค้า 7 วัน · จัดส่งทั่วไทย · เก็บเงินปลายทางได้ · <a href="${esc(SITE_URL)}/shipping">ดูรายละเอียดการจัดส่งและการรับประกัน</a></p>
<p><a href="${esc(pageUrl)}">ดูสินค้า ${esc(product.name)}</a> ที่ <a href="${esc(SITE_URL)}/shop">ร้าน Bt music drive</a></p>
</body>
</html>`;

  res.status(200).type('html').send(html);
  return true;
}
