import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const cat = await prisma.category.findFirst({
  where: { OR: [{ name: 'หมอลำ' }, { slug: 'mor-lam' }] },
  include: { _count: { select: { products: true } } },
});

if (!cat) {
  console.log('Not found — nothing to delete');
} else if (cat._count.products > 0) {
  console.log(`ABORT: ${cat._count.products} products still linked to หมอลำ. Move them first.`);
  process.exitCode = 1;
} else {
  await prisma.category.delete({ where: { id: cat.id } });
  console.log(`Deleted: ${cat.name} (id=${cat.id})`);
}

await prisma.$disconnect();
