import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const categories = JSON.parse(
  readFileSync(join(__dirname, '../../categories.json'), 'utf8')
);

let created = 0, updated = 0, skipped = 0;

for (const cat of categories) {
  const existing = await prisma.category.findUnique({ where: { name: cat.name } });
  if (existing) {
    if (existing.slug !== cat.slug) {
      await prisma.category.update({
        where: { id: existing.id },
        data: { slug: cat.slug },
      });
      console.log(`UPDATED slug: ${cat.name} → ${cat.slug}`);
      updated++;
    } else {
      skipped++;
    }
  } else {
    await prisma.category.create({
      data: { name: cat.name, slug: cat.slug },
    });
    console.log(`CREATED: ${cat.name} (${cat.slug})`);
    created++;
  }
}

console.log(`\nDone — created: ${created}, updated: ${updated}, skipped: ${skipped}`);
await prisma.$disconnect();
