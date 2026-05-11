// อัปเดต imageUrl และ images ของสินค้าใน DB จาก products.json
// รัน: node scripts/push-images-to-db.js [slug]
// ถ้าไม่ระบุ slug จะอัปเดตทุกสินค้าที่เปลี่ยนแปลง
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '..', 'server', 'node_modules', '@prisma', 'client'));

for (const name of ['.env', '.env.local']) {
  const dotenvPath = path.join(__dirname, '..', 'server', name);
  if (fs.existsSync(dotenvPath)) {
    for (const line of fs.readFileSync(dotenvPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  }
}

const targetSlug = process.argv[2] || null;

(async () => {
  const prisma = new PrismaClient();
  try {
    const jsonPath = path.join(__dirname, '..', 'products.json');
    const products = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const targets = targetSlug ? products.filter(p => p.slug === targetSlug) : products;

    if (targets.length === 0) {
      console.log(`ไม่พบสินค้า slug: ${targetSlug}`);
      return;
    }

    let updated = 0;
    for (const p of targets) {
      if (!p.id) continue;
      await prisma.product.update({
        where: { id: p.id },
        data: {
          imageUrl: p.imageUrl || null,
          images: Array.isArray(p.images) ? p.images : [],
        },
      });
      console.log(`  อัปเดตรูป: ${p.slug}`);
      updated++;
    }
    console.log(`เสร็จ! อัปเดต ${updated} สินค้า`);
  } finally {
    await prisma.$disconnect();
  }
})();
