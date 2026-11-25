import prisma from '../lib/prisma';
import { resolveProductSlug, shouldRefreshProductSlug } from '../lib/productSlug';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');

  const products = await prisma.product.findMany({
    select: { id: true, name: true, sku: true, slug: true },
    orderBy: { createdAt: 'asc' },
  });

  let updated = 0;
  let skipped = 0;

  for (const p of products) {
    const needs = force || shouldRefreshProductSlug(p.slug);
    if (!needs) {
      skipped++;
      continue;
    }
    const next = await resolveProductSlug(p.slug, p.name, p.sku, p.id);
    if (next === p.slug) {
      skipped++;
      continue;
    }
    console.log(`${p.id}  ${p.name}\n  ${p.slug ?? '(null)'}  ->  ${next}`);
    if (!dryRun) {
      await prisma.product.update({ where: { id: p.id }, data: { slug: next } });
    }
    updated++;
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}updated=${updated} skipped=${skipped} total=${products.length}`);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
