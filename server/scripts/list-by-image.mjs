import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const products = await prisma.product.findMany({
  select: { id: true, name: true, imageUrl: true, stock: true, _count: { select: { orderItems: true, cartItems: true } } },
  orderBy: { name: 'asc' },
});

const placeholder = [];
const hasImage = [];
for (const p of products) {
  const isPh = !p.imageUrl || p.imageUrl === '/images/USB_MP3.png' || p.imageUrl === '/images/USB_MP3.webp' || p.imageUrl.includes('unsplash');
  (isPh ? placeholder : hasImage).push(p);
}

console.log(`\n=== มีรูปตรงธีม (${hasImage.length}) — เก็บไว้ ===`);
for (const p of hasImage) {
  console.log(`  [${p.id.slice(0,8)}] stock=${p.stock} orders=${p._count.orderItems}`);
  console.log(`    ${p.name}`);
  console.log(`    ${p.imageUrl}`);
}

console.log(`\n=== ยังเป็น placeholder (${placeholder.length}) — ลบได้ ===`);
for (const p of placeholder) {
  const risky = p._count.orderItems > 0 || p._count.cartItems > 0;
  console.log(`  [${p.id.slice(0,8)}] stock=${p.stock} orders=${p._count.orderItems} carts=${p._count.cartItems}${risky ? ' ⚠️' : ''}`);
  console.log(`    ${p.name}`);
}

await prisma.$disconnect();
