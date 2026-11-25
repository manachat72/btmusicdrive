import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const fallback = JSON.parse(readFileSync(join(__dirname, '../../products.json'), 'utf8'));

const dbProducts = await prisma.product.findMany({
  select: { id: true, name: true, imageUrl: true, images: true },
});

console.log('=== DB products ===');
for (const p of dbProducts) {
  console.log(`[${p.id}] ${p.name}`);
  console.log(`  imageUrl: ${p.imageUrl}`);
  console.log(`  images: ${JSON.stringify(p.images)}`);
}

console.log('\n=== products.json ===');
for (const p of fallback) {
  console.log(`[${p.id}] ${p.name}`);
  console.log(`  imageUrl: ${p.imageUrl}`);
  console.log(`  images: ${JSON.stringify(p.images)}`);
}

await prisma.$disconnect();
