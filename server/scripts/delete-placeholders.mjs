import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const products = await prisma.product.findMany({
  select: { id: true, name: true, imageUrl: true, _count: { select: { orderItems: true, cartItems: true } } },
});

let deleted = 0, skipped = 0;
for (const p of products) {
  const isPh = !p.imageUrl || p.imageUrl === '/images/USB_MP3.png' || p.imageUrl === '/images/USB_MP3.webp' || p.imageUrl.includes('unsplash');
  if (!isPh) continue;
  if (p._count.orderItems > 0 || p._count.cartItems > 0) {
    console.log(`SKIP (มี order/cart) [${p.id.slice(0,8)}] ${p.name.slice(0,50)}`);
    skipped++;
    continue;
  }
  await prisma.product.delete({ where: { id: p.id } });
  console.log(`DEL  [${p.id.slice(0,8)}] ${p.name.slice(0,60)}`);
  deleted++;
}

console.log(`\nDeleted: ${deleted}, Skipped: ${skipped}`);
const remaining = await prisma.product.count();
console.log(`Remaining products in DB: ${remaining}`);

await prisma.$disconnect();
