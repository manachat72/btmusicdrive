import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const toDelete = [
  { id: '37669bd1-9aec-489e-80ab-7ce468608f84', label: 'คาราบาว 4GB (ตัวเก่า 219฿)' },
  { id: '0bd64129-3e61-4c20-871a-1b91e8e5d815', label: 'เสียงสตอ (ตัวเก่า)' },
];

for (const d of toDelete) {
  // ปลอดภัย: ตรวจว่าไม่มี order ผูกอยู่
  const orderCount = await prisma.orderItem.count({ where: { productId: d.id } });
  const cartCount = await prisma.cartItem.count({ where: { productId: d.id } });
  if (orderCount > 0 || cartCount > 0) {
    console.log(`SKIP ${d.label} — orders=${orderCount} carts=${cartCount}`);
    continue;
  }
  await prisma.product.delete({ where: { id: d.id } });
  console.log(`DELETED ${d.label} [${d.id}]`);
}

await prisma.$disconnect();
