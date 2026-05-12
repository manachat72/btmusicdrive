/**
 * fix-sku099-images.mjs
 * อัปเดต URL รูป SKU-099 ใน DB (ลบ hash suffix ออก)
 * Run: node server/scripts/fix-sku099-images.mjs
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');

for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const prisma = new PrismaClient();

(async () => {
  try {
    const slug = 'usb-mp3-thai-rock-2000';
    const images = [1,2,3,4].map(i => `/images/products/${slug}/${slug}-${i}.webp`);

    await prisma.product.update({
      where: { slug },
      data: {
        imageUrl: images[0],
        images,
      },
    });
    console.log(`[UPDATE] SKU-099 ${slug}`);
    console.log(`  imageUrl: ${images[0]}`);
    console.log(`  images:   ${images.join(', ')}`);

    // sync products.json จาก DB
    const all = await prisma.product.findMany({
      orderBy: { createdAt: 'asc' },
      include: { category: { select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true } } },
    });
    const shaped = all.map(p => ({
      id: p.id, name: p.name, slug: p.slug,
      description: p.description,
      price: p.price, originalPrice: p.originalPrice,
      stock: p.stock,
      imageUrl: p.imageUrl,
      images: p.images || [],
      brand: p.brand,
      sku: p.sku,
      tags: p.tags || [],
      tracklist: p.tracklist || [],
      specs: p.specs || {},
      isActive: p.isActive,
      categoryId: p.categoryId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      category: p.category || null,
    }));

    const outPath = join(__dirname, '..', '..', 'products.json');
    writeFileSync(outPath, JSON.stringify(shaped, null, 2) + '\n', 'utf8');
    console.log(`\nproducts.json อัปเดตแล้ว (${shaped.length} สินค้า)`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
})();
