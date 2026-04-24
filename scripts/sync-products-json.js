// Regenerates products.json from the live Neon DB so the inlined homepage
// cards match the real catalog. Run with: node scripts/sync-products-json.js
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '..', 'server', 'node_modules', '@prisma', 'client'));

const dotenvPath = path.join(__dirname, '..', 'server', '.env');
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

(async () => {
  const prisma = new PrismaClient();
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'asc' },
      include: { category: { select: { id: true, name: true } } },
    });
    const shaped = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      originalPrice: p.originalPrice,
      description: p.description,
      imageUrl: p.imageUrl,
      images: p.images || [],
      brand: p.brand,
      sku: p.sku,
      stock: p.stock,
      tags: p.tags || [],
      tracklist: p.tracklist || [],
      specs: p.specs || {},
      categoryId: p.categoryId,
      category: p.category ? { id: p.category.id, name: p.category.name } : null,
    }));
    const out = path.join(__dirname, '..', 'products.json');
    fs.writeFileSync(out, JSON.stringify(shaped, null, 2) + '\n', 'utf8');
    console.log(`Wrote ${shaped.length} products to ${out}`);
  } finally {
    await prisma.$disconnect();
  }
})();
