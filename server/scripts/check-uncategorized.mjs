import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const cat = await prisma.category.findFirst({
  where: { name: 'Uncategorized' },
  include: { products: { select: { id: true, name: true, price: true } } },
});

if (!cat) {
  console.log('No "Uncategorized" category in DB');
} else {
  console.log(`Category: ${cat.name} (id=${cat.id}, slug=${cat.slug})`);
  console.log(`Products linked: ${cat.products.length}`);
  cat.products.forEach(p => console.log(`  - ${p.name} (฿${p.price})`));
}

await prisma.$disconnect();
