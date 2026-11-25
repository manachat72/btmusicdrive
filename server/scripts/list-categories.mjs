import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const cats = await prisma.category.findMany({
  orderBy: { createdAt: 'asc' },
  select: { id: true, name: true, slug: true },
});
cats.forEach(c => console.log(`  ${c.name.padEnd(15)} ${c.slug || '(no slug)'}`));
console.log(`\nTotal: ${cats.length}`);
await prisma.$disconnect();
