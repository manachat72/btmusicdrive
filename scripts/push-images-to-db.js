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
    let created = 0;
    let jsonChanged = false;
    for (const p of targets) {
      if (!p.id && !p.slug) {
        console.log('  ข้ามสินค้า: ไม่มี id หรือ slug');
        continue;
      }
      const existing = await prisma.product.findFirst({
        where: {
          OR: [
            p.id ? { id: p.id } : undefined,
            p.slug ? { slug: p.slug } : undefined,
          ].filter(Boolean),
        },
        select: { id: true, slug: true },
      });

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            imageUrl: p.imageUrl || null,
            images: Array.isArray(p.images) ? p.images : [],
          },
        });
        if (p.id !== existing.id) {
          p.id = existing.id;
          jsonChanged = true;
        }
        console.log(`  อัปเดตรูป: ${p.slug}`);
        updated++;
        continue;
      }

      const categoryName = p.category?.name || p.categoryName || 'Uncategorized';
      const category = await prisma.category.upsert({
        where: { name: categoryName },
        update: {},
        create: { name: categoryName },
        select: { id: true, name: true },
      });

      const product = await prisma.product.create({
        data: {
          name: p.name || p.slug || 'New product',
          slug: p.slug || null,
          price: Number(p.price) || 279,
          originalPrice: p.originalPrice == null ? null : Number(p.originalPrice),
          description: p.description || null,
          imageUrl: p.imageUrl || null,
          images: Array.isArray(p.images) ? p.images : [],
          brand: p.brand || 'btmusicdrive',
          sku: p.sku || null,
          stock: Number.isFinite(Number(p.stock)) ? Number(p.stock) : 100,
          tags: Array.isArray(p.tags) ? p.tags : [],
          tracklist: Array.isArray(p.tracklist) ? p.tracklist : [],
          specs: p.specs || {},
          categoryId: category.id,
        },
        select: { id: true },
      });
      p.id = product.id;
      p.categoryId = category.id;
      p.category = { id: category.id, name: category.name };
      jsonChanged = true;
      console.log(`  สร้างสินค้าใหม่ใน DB: ${p.slug}`);
      created++;
    }
    if (jsonChanged) {
      fs.writeFileSync(jsonPath, JSON.stringify(products, null, 2) + '\n', 'utf8');
      console.log('  อัปเดต products.json ด้วย id/category จาก DB');
    }
    console.log(`เสร็จ! อัปเดต ${updated} สินค้า | สร้างใหม่ ${created} สินค้า`);
  } finally {
    await prisma.$disconnect();
  }
})();
