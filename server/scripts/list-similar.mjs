import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const products = await prisma.product.findMany({
  select: { id: true, name: true, price: true, stock: true, createdAt: true },
  orderBy: { name: 'asc' },
});

// หาสินค้าที่ keyword คล้ายกัน (ชื่อเริ่มเหมือนกัน 15 ตัวอักษร หรือ keyword หลักซ้ำ)
console.log(`Total products: ${products.length}\n`);

const keywords = ['คาราบาว', 'เสียงสตอ', 'เพลงใต้', 'ลูกทุ่ง', '90', 'ลูกกรุง', 'สตริง', 'สากล', 'เพื่อชีวิต', '3 ช่า', 'เสก', 'TikTok', 'พงษ์สิทธิ์', 'แดนซ์', '2000', '100 ล้าน', 'ครูสลา'];
for (const kw of keywords) {
  const matches = products.filter(p => p.name.includes(kw));
  if (matches.length > 1) {
    console.log(`\n== "${kw}" (${matches.length} ตัว) ==`);
    for (const m of matches) {
      console.log(`  [${m.id.slice(0,8)}] ${m.price}฿ stock=${m.stock} ${m.createdAt.toISOString().slice(0,10)}`);
      console.log(`    ${m.name}`);
    }
  }
}

await prisma.$disconnect();
