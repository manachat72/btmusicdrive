import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

const SITE_URL = process.env.FRONTEND_URL || 'https://btmusicdrive.com';

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000);
}

function absoluteUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// GET /api/feed/meta  — Meta Product Catalog feed (RSS/XML)
router.get('/meta', async (req: Request, res: Response) => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      originalPrice: true,
      stock: true,
      imageUrl: true,
      images: true,
      brand: true,
      slug: true,
      category: { select: { name: true } },
    },
    orderBy: { slug: 'asc' },
  });

  const items = products
    .map((p) => {
      const availability = p.stock > 0 ? 'in stock' : 'out of stock';
      const priceStr = `${p.price.toFixed(2)} THB`;
      const link = `${SITE_URL}/product/${p.slug}`;
      const imageLink = absoluteUrl(p.imageUrl || '');
      const additionalImages = (p.images as string[])
        .filter((img) => img !== p.imageUrl)
        .slice(0, 9)
        .map((img) => `    <g:additional_image_link>${escapeXml(absoluteUrl(img))}</g:additional_image_link>`)
        .join('\n');

      const descriptionRaw = stripHtml(p.description || p.name);
      const hasDiscount = p.originalPrice && p.originalPrice > p.price;
      const salePriceTag = hasDiscount
        ? `    <g:sale_price>${escapeXml(priceStr)}</g:sale_price>\n    <g:price>${escapeXml(`${p.originalPrice!.toFixed(2)} THB`)}</g:price>`
        : `    <g:price>${escapeXml(priceStr)}</g:price>`;

      return `  <item>
    <g:id>${escapeXml(p.id)}</g:id>
    <g:title>${escapeXml(p.name)}</g:title>
    <g:description>${escapeXml(descriptionRaw)}</g:description>
    <g:link>${escapeXml(link)}</g:link>
    <g:image_link>${escapeXml(imageLink)}</g:image_link>
${additionalImages ? additionalImages + '\n' : ''}    <g:availability>${availability}</g:availability>
    <g:condition>new</g:condition>
${salePriceTag}
    <g:brand>${escapeXml(p.brand || 'btmusicdrive')}</g:brand>
    <g:google_product_category>Electronics &gt; Audio &gt; Digital Media Players</g:google_product_category>
    <g:product_type>${escapeXml(p.category?.name || 'แฟลชไดร์ฟเพลง MP3')}</g:product_type>
  </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>BT Music Drive</title>
    <link>${SITE_URL}</link>
    <description>แฟลชไดร์ฟเพลง MP3 คุณภาพสูง หลากหลายแนวเพลง</description>
${items}
  </channel>
</rss>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  res.send(xml);
});

export default router;
