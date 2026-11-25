import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const products = await prisma.product.findMany({
  select: {
    id: true, name: true, imageUrl: true, price: true, stock: true,
    createdAt: true, _count: { select: { orderItems: true } },
  },
  orderBy: { name: 'asc' },
});

const byName = new Map();
for (const p of products) {
  const key = p.name.trim();
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(p);
}

const dups = [...byName.entries()].filter(([, arr]) => arr.length > 1);
console.log(`Found ${dups.length} duplicate names:\n`);
for (const [name, arr] of dups) {
  console.log(`"${name}"`);
  for (const p of arr) {
    console.log(`  - ${p.id}`);
    console.log(`    price=${p.price} stock=${p.stock} orders=${p._count.orderItems}`);
    console.log(`    image=${p.imageUrl}`);
    console.log(`    created=${p.createdAt.toISOString()}`);
  }
  console.log();
}

await prisma.$disconnect();
