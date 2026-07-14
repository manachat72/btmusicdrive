import { Response } from 'express';
import prisma from './prisma';

// Social scrapers ไม่รัน JS — ต้อง render OG meta ฝั่ง server ให้ /product/:slug
// (LINE ใช้ UA facebookexternalhit;line-poker)
const SOCIAL_BOT_RE =
  /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|WhatsApp|Discordbot|Pinterestbot|SkypeUriPreview|line-poker/i;

export function isSocialBot(userAgent: string | undefined): boolean {
  return !!userAgent && SOCIAL_BOT_RE.test(userAgent);
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
  const title = `${product.name} — Bt music drive`;
  const description = (product.description || '').trim().slice(0, 200)
    || `${product.name} แฟลชไดร์ฟเพลง MP3 เสียบปุ๊บฟังปั๊บ ไม่ต้องใช้เน็ต จัดส่งทั่วไทย`;
  const productImage = absoluteImageUrl(product.imageUrl);
  const ogImages = [productImage, FALLBACK_OG_IMAGE].filter(Boolean) as string[];

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
<link rel="canonical" href="${esc(pageUrl)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Bt music drive">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${ogImages.map((img) => `<meta property="og:image" content="${esc(img)}">`).join('\n')}
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:locale" content="th_TH">
<meta property="product:price:amount" content="${esc(product.price)}">
<meta property="product:price:currency" content="THB">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(ogImages[0])}">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
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
