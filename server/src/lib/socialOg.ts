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
      imageUrl: true,
      stock: true,
      slug: true,
    },
  });
  if (!product) return false;

  const pageUrl = `${SITE_URL}/product/${encodeURIComponent(product.slug || slug)}`;
  const title = buildSeoTitle(product.name);
  const descriptionSource = (product.description || '').trim()
    || `${product.name} แฟลชไดร์ฟเพลง MP3 เสียบปุ๊บฟังปั๊บ ไม่ต้องใช้เน็ต จัดส่งทั่วไทย`;
  const description = truncateAtWord(descriptionSource, 155);
  const productImage = absoluteImageUrl(product.imageUrl);
  const ogImages = [productImage, FALLBACK_OG_IMAGE].filter(Boolean) as string[];

  // โครงเดียวกับ breadcrumb ฝั่ง client (product.html) — อย่าให้สองที่นี้ต่างกัน
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'หน้าหลัก', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'ร้านค้า', item: `${SITE_URL}/shop` },
      { '@type': 'ListItem', position: 3, name: product.name, item: pageUrl },
    ],
  };

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description,
    image: ogImages,
    url: pageUrl,
    brand: { '@type': 'Brand', name: 'Bt music drive' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'THB',
      price: product.price,
      availability: product.stock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: pageUrl,
    },
  };

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
<h1>${esc(product.name)}</h1>
<p>${esc(description)}</p>
<a href="${esc(pageUrl)}">ดูสินค้า ${esc(product.name)}</a>
</body>
</html>`;

  res.status(200).type('html').send(html);
  return true;
}
