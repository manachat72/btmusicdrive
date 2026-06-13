/**
 * update-sku086-desc.mjs
 * แก้ description ของ SKU-086 (คาราบาว 4GB ฿199 ไม่มีของแถม) ให้ตรง specs:
 *   2GB -> 4GB, 128kbps -> 320kbps, trust badge ตาม policy จริง
 * Backup ค่าเดิมไว้ที่ sku086-desc-backup-<ts>.json ก่อนเขียน
 * Run: node server/scripts/update-sku086-desc.mjs
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const SKU = 'SKU-086';
const newDesc = readFileSync(join(__dirname, 'sku086-new-desc.html'), 'utf8').trim();
const prisma = new PrismaClient();

(async () => {
  try {
    const p = await prisma.product.findFirst({ where: { sku: SKU } });
    if (!p) { console.error(`❌ ไม่พบสินค้า sku=${SKU}`); process.exit(1); }

    const ts = Date.now();
    const backupPath = join(__dirname, `sku086-desc-backup-${ts}.json`);
    writeFileSync(backupPath, JSON.stringify(
      { sku: SKU, id: p.id, name: p.name, oldDescription: p.description, backedUpAt: new Date().toISOString() },
      null, 2), 'utf8');
    console.log(`💾 backup เดิมไว้ที่: ${backupPath}`);
    console.log(`   old length: ${(p.description || '').length} chars`);

    const updated = await prisma.product.update({
      where: { id: p.id },
      data: { description: newDesc },
    });
    console.log(`✅ อัปเดต description ${SKU} (${p.name}) สำเร็จ`);
    console.log(`   new length: ${updated.description.length} chars`);
  } catch (e) {
    console.error('❌ error:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
