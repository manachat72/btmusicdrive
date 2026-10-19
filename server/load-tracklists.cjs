// One-off: tracklist + specs.จำนวนเพลง ← ไฟล์จริงใน Z:\music (เฉพาะตัวที่จับคู่โฟลเดอร์ได้ชัด)
// Dry-run by default, --commit to write (backs up first).
require('dotenv').config({ path: __dirname + '/.env.local' });
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const NAS = 'Z:/music';
const SKUS = ['BT-PC-04-032', 'BT-TA-02-039', 'BT-ST-02-056'];
const AUDIO = /\.(mp3|m4a|wma|wav|flac)$/i;
const byName = new Intl.Collator('en', { numeric: true }).compare;

(async () => {
  const dirs = fs.readdirSync(NAS);
  const rows = await prisma.product.findMany({
    where: { sku: { in: SKUS } },
    select: { id: true, sku: true, slug: true, tracklist: true, specs: true },
    orderBy: { sku: 'asc' },
  });
  if (rows.length !== SKUS.length) throw new Error(`เจอ ${rows.length}/${SKUS.length} ตัวใน DB`);
  const plan = rows.map(r => {
    const set = r.sku.split('-').pop();
    const dir = dirs.filter(d => d.startsWith(set + '.'));
    if (dir.length !== 1) throw new Error(`${r.sku}: โฟลเดอร์ NAS ${dir.length} ตัว`);
    const tracklist = fs.readdirSync(path.join(NAS, dir[0]))
      .filter(f => AUDIO.test(f)).sort(byName).map(f => f.replace(AUDIO, ''));
    if (!tracklist.length) throw new Error(`${r.sku}: โฟลเดอร์ว่าง`);
    const specs = { ...(r.specs || {}), 'จำนวนเพลง': `${tracklist.length} เพลง` };
    const removed = (r.tracklist || []).filter(t => !tracklist.includes(t));
    console.log(`${r.sku}  ${r.slug}  ← ${dir[0]}`);
    console.log(`  tracklist ${(r.tracklist || []).length} → ${tracklist.length} · specs.จำนวนเพลง "${(r.specs || {})['จำนวนเพลง']}" → "${specs['จำนวนเพลง']}"`);
    if (removed.length) console.log('  ตัดออก:', removed.join(' | '));
    return { id: r.id, tracklist, specs };
  });
  if (!process.argv.includes('--commit')) { console.log('dry-run, nothing written'); return; }
  const f = `${__dirname}/tracklist-backup-${Date.now()}.json`;
  fs.writeFileSync(f, JSON.stringify(rows, null, 2));
  for (const p of plan) await prisma.product.update({ where: { id: p.id }, data: { tracklist: p.tracklist, specs: p.specs } });
  console.log('written', plan.length, '· backup', f);
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
