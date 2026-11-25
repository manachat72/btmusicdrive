import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const cat = await prisma.category.findFirst({
  where: { OR: [{ name: 'หมอลำ' }, { slug: 'mor-lam' }] },
  include: { products: { select: { id: true, name: true } } },
});

if (!cat) {
  console.log('Category "หมอลำ" not found in DB');
} else {
  console.log(`Found: id=${cat.id}, name=${cat.name}, slug=${cat.slug}`);
  console.log(`Products linked: ${cat.products.length}`);
  cat.products.forEach(p => console.log(`  - ${p.id}: ${p.name}`));
}

await prisma.$disconnect();
