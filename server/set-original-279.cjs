// One-off: originalPrice 319 -> 279. Dry-run by default, --commit to write (backs up first).
require('dotenv').config({ path: __dirname + '/.env.local' });
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.product.findMany({
    where: { originalPrice: 319 },
    select: { id: true, sku: true, name: true, price: true, originalPrice: true, isActive: true },
    orderBy: { sku: 'asc' },
  });
  console.log('match', rows.length);
  const bad = rows.filter(r => Number(r.price) >= 279);
  console.log('price >= 279 (strike would be <= price):', bad.map(r => `${r.sku} ${r.price}`));
  const dist = {}; rows.forEach(r => { const k = `${r.price}|${r.isActive}`; dist[k] = (dist[k] || 0) + 1; });
  console.log('price|active dist', dist);
  if (!process.argv.includes('--commit')) { console.log('dry-run, nothing written'); return; }
  const f = `${__dirname}/originalprice-backup-${Date.now()}.json`;
  fs.writeFileSync(f, JSON.stringify(rows, null, 2));
  const r = await prisma.product.updateMany({ where: { id: { in: rows.map(x => x.id) } }, data: { originalPrice: 279 } });
  console.log('updated', r.count, 'backup', f);
})().finally(() => prisma.$disconnect());
