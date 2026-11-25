import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import prisma from './prisma';
import { categoryNameKey, normalizeCategoryName } from './categoryName';

const SITE_URL = 'https://btmusicdrive.com';
const FALLBACK_OG_IMAGE = `${SITE_URL}/images/og-cover.jpg`;
const MAX_PRODUCTS_IN_LIST = 24;

const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE_URL}/${url.replace(/^\/+/, '')}`;
}

type StaticCategoryMeta = {
  id?: string;
  name: string;
  slug: string;
  imageUrl?: string;
  h1Description?: string;
  titleTag?: string;
  metaDescription?: string;
};

// categories.json เป็น source เดียวกับที่ frontend ใช้ inline สำหรับ title/description
// ต่อหมวด — โหลดครั้งเดียวแล้ว cache ไว้ใน memory ของ serverless instance
let staticCategoriesCache: StaticCategoryMeta[] | null = null;
function loadStaticCategories(): StaticCategoryMeta[] {
  if (staticCategoriesCache) return staticCategoriesCache;
  try {
    const raw = fs.readFileSync(path.join(__dirname, '../../../categories.json'), 'utf8');
    staticCategoriesCache = JSON.parse(raw);
  } catch (err) {
    console.error('[categoryOg] failed to load categories.json', err);
    staticCategoriesCache = [];
  }
  return staticCategoriesCache || [];
}

/**
 * Render หน้า HTML เบาๆ ที่มี meta/OG/Twitter + ItemList/BreadcrumbList JSON-LD
 * และรายการสินค้าจริงในหมวด ให้ social scraper และ search crawler เห็นเนื้อหา
 * โดยไม่ต้องรอ JavaScript ฝั่ง client โหลด categories.json/products แล้วเขียน DOM เอง
 * คืน true ถ้า render สำเร็จ, false ถ้าไม่พบหมวดหมู่ (ให้ caller ตอบแบบเดิมต่อ)
 */
export async function renderCategoryOgPage(slug: string, res: Response): Promise<boolean> {
  const staticCategories = loadStaticCategories();
  const staticMeta = staticCategories.find((c) => c.slug === slug);

  // หา Category record ใน DB ที่ตรงกับ slug นี้ (อาจมีหลาย row ชื่อซ้ำ — dedupe ด้วย categoryNameKey)
  const dbCategoryBySlug = await prisma.category.findFirst({ where: { slug } });
  const categoryName = normalizeCategoryName(
    dbCategoryBySlug?.name || staticMeta?.name || '',
  );
  if (!categoryName) return false;

  const key = categoryNameKey(categoryName);
  const allDbCategories = await prisma.category.findMany({ select: { id: true, name: true } });
  const matchingCategoryIds = allDbCategories
    .filter((c) => categoryNameKey(c.name) === key)
    .map((c) => c.id);

  const products = matchingCategoryIds.length
    ? await prisma.product.findMany({
        where: { isActive: true, categoryId: { in: matchingCategoryIds } },
        select: { name: true, slug: true, price: true, originalPrice: true, imageUrl: true, tracklist: true },
        orderBy: { createdAt: 'desc' },
        take: MAX_PRODUCTS_IN_LIST,
      })
    : [];

  const pageUrl = `${SITE_URL}/category/${slug}`;
  const title = staticMeta?.titleTag || `${categoryName} — Bt music drive`;
  const description = staticMeta?.metaDescription
    || `เลือกซื้อแฟลชไดร์ฟเพลง MP3 หมวด ${categoryName} เสียงชัด HD เสียบปุ๊บฟังปั๊บ จัดส่งทั่วไทย — Bt music drive`;
  const h1Description = staticMeta?.h1Description || `รวมสินค้าคุณภาพในหมวด ${categoryName}`;
  const bannerImage = absoluteUrl(staticMeta?.imageUrl) || FALLBACK_OG_IMAGE;

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'หน้าหลัก', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: categoryName, item: pageUrl },
    ],
  };

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/product/${p.slug}`,
      name: p.name,
    })),
  };

  const productsHtml = products.length
    ? `<ul>${products
        .map((p) => {
          const songCount = Array.isArray(p.tracklist) ? p.tracklist.length : 0;
          const priceText = p.originalPrice && p.originalPrice > p.price
            ? `${esc(p.price)} บาท (ปกติ ${esc(p.originalPrice)} บาท)`
            : `${esc(p.price)} บาท`;
          return `<li><a href="${esc(SITE_URL)}/product/${esc(p.slug)}">${esc(p.name)}</a> — ${priceText}${songCount ? ` — ${songCount} เพลง` : ''}</li>`;
        })
        .join('')}</ul>`
    : `<p>ยังไม่มีสินค้าที่เผยแพร่ในหมวดนี้ในขณะนี้ กรุณาดูสินค้าทั้งหมดได้ที่ <a href="${esc(SITE_URL)}/shop">ร้านค้า</a></p>`;

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${esc(pageUrl)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Bt music drive">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(bannerImage)}">
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:locale" content="th_TH">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(bannerImage)}">
<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
<script type="application/ld+json">${JSON.stringify(itemListLd)}</script>
</head>
<body>
<nav>
<a href="${esc(SITE_URL)}/">หน้าหลัก</a> &raquo; <span>${esc(categoryName)}</span>
</nav>
<h1>${esc(categoryName)}</h1>
<p>${esc(h1Description)}</p>
<h2>สินค้าในหมวด ${esc(categoryName)} (${products.length}${products.length === MAX_PRODUCTS_IN_LIST ? '+' : ''} รายการ)</h2>
${productsHtml}
<p><a href="${esc(SITE_URL)}/shop">ดูสินค้าทั้งหมด</a></p>
</body>
</html>`;

  res.status(200).type('html').send(html);
  return true;
}
