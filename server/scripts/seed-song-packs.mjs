/**
 * seed-song-packs.mjs
 * Creates the 2 extra-song-pack Products (10 songs / 19.- and 20 songs / 30.-)
 * so the existing cart/order pricing + free-shipping logic handles them with
 * zero new rules (dev_lead decision 2026-11-22). Hidden from storefront via
 * isActive: false. stock is huge instead of "don't decrement stock" branch.
 * shortcut: stock=1_000_000 stands in for "unlimited digital stock", bump if
 * a real digital-stock flag gets added later.
 * Run: node server/scripts/seed-song-packs.mjs
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=\"?([^\"]*)\"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const prisma = new PrismaClient();

// Any existing category works — the pack is hidden (isActive: false) so it
// never shows up in that category's listing.
const FALLBACK_CATEGORY_ID = '94703150-5b4b-4344-80cf-baadcdc0d0b2'; // เพลงสตริง

const PACKS = [
  {
    id: 'song-pack-10',
    slug: 'song-pack-10',
    name: 'แพ็กเพลงพิเศษ 10 เพลง',
    price: 19,
    specs: { songPack: 10 },
  },
  {
    id: 'song-pack-20',
    slug: 'song-pack-20',
    name: 'แพ็กเพลงพิเศษ 20 เพลง',
    price: 30,
    specs: { songPack: 20 },
  },
];

(async () => {
  try {
    const category = await prisma.category.findFirst({ where: { id: FALLBACK_CATEGORY_ID } });
    const categoryId = category ? category.id : (await prisma.category.findFirstOrThrow()).id;

    for (const p of PACKS) {
      const result = await prisma.product.upsert({
        where: { slug: p.slug },
        update: { name: p.name, price: p.price, specs: p.specs, isActive: false, stock: 1_000_000 },
        create: {
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          description: null,
          brand: 'btmusicdrive',
          stock: 1_000_000,
          isActive: false,
          tags: ['song-pack'],
          specs: p.specs,
          categoryId,
        },
      });
      console.log(`[OK] ${result.id} ${result.slug} price=${result.price} isActive=${result.isActive} stock=${result.stock}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
