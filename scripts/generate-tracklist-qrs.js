#!/usr/bin/env node
/**
 * สร้างหน้ารายชื่อเพลง + QR ให้ครบทุกสินค้าในรอบเดียว
 *
 * ดึง tracklist จาก products.json (ข้อมูลเดียวกับหน้าเว็บ) → สร้างหน้าเว็บธีมทอง-ดำ
 * ต่อสินค้า → อัปขึ้น R2 docs/tracklist-<code>.html → สร้าง QR qr/qr-tracklist-<code>.png
 * → ลงทะเบียนในคลัง QR ของ Listing Studio
 *
 * URL ใช้เลข code คงที่ (docs/tracklist-16.html) — เปลี่ยนชื่อสินค้าภายหลัง QR ก็ไม่เสีย
 * รันซ้ำได้: อัปทับหน้าเดิมด้วยข้อมูลล่าสุดเสมอ (URL เดิม QR ที่พิมพ์ไปแล้วใช้ต่อได้)
 *
 * Usage:
 *   node scripts/generate-tracklist-qrs.js            # dry-run
 *   node scripts/generate-tracklist-qrs.js --apply
 *   node scripts/generate-tracklist-qrs.js --apply --code 16   # เฉพาะตัวเดียว
 */
const fs = require('fs');
const path = require('path');
const { makeTracklistQr, loadQrReg, saveQrReg } = require('./lib/tracklist-qr');

const ROOT = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const arg = (f) => { const i = argv.indexOf(f); return i !== -1 && argv[i + 1] ? argv[i + 1] : null; };

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const bg = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const A = bg(a), B = bg(b); let inter = 0;
  for (const [g, n] of A) if (B.has(g)) inter += Math.min(n, B.get(g));
  const t = [...A.values()].reduce((x, y) => x + y, 0) + [...B.values()].reduce((x, y) => x + y, 0);
  return t ? 2 * inter / t : 0;
}

(async () => {
  const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'marketplace-images', 'catalog.json'), 'utf8')).products;

  // จับคู่สินค้า → code ของ catalog (ใช้ตั้งชื่อไฟล์/URL ให้คงที่)
  const jobs = [];
  const usedCodes = new Set();
  for (const p of products) {
    if (!Array.isArray(p.tracklist) || !p.tracklist.length) continue;
    let best = null, score = 0;
    for (const c of catalog) { const s = similarity(norm(p.name), norm(c.title)); if (s > score) { score = s; best = c; } }
    let code = score >= 0.5 && best && !usedCodes.has(best.code) ? best.code : null;
    if (code) usedCodes.add(code);
    else code = 'x' + String(p.sku || p.slug || p.id).replace(/[^a-z0-9]/gi, '').slice(-6);   // ไม่มีใน catalog → ใช้รหัสจาก sku
    jobs.push({ code, product: p });
  }

  const only = arg('--code');
  const list = only ? jobs.filter(j => j.code === String(only).padStart(2, '0')) : jobs;
  console.log(`สินค้าที่มีรายชื่อเพลง: ${jobs.length}${only ? ` → เลือกเฉพาะ ${list.length}` : ''}`);

  if (!APPLY) {
    list.forEach(j => console.log(`  ${j.code}  ${j.product.tracklist.length} เพลง  ${j.product.name.slice(0, 50)}`));
    console.log('\n(dry run — ใส่ --apply เพื่อทำจริง)');
    return;
  }

  let totalKb = 0;

  for (const j of list) {
    const p = j.product;
    try {
      const r = await makeTracklistQr({ code: j.code, name: p.name, tracklist: p.tracklist });
      totalKb += r.kb;
      console.log(`  ✔ ${j.code}  ${String(p.tracklist.length).padStart(3)} เพลง  ${r.kb.toFixed(0)} KB  ${p.name.slice(0, 45)}`);
    } catch (e) {
      console.error(`  ✖ ${j.code} ${String(e.message).slice(0, 120)}`);
    }
  }

  saveQrReg(loadQrReg().sort((a, b) => String(a.name).localeCompare(String(b.name), 'th')));

  console.log(`\n✔ เสร็จ ${list.length} สินค้า · หน้าเว็บรวม ${(totalKb / 1024).toFixed(2)} MB บน R2 (โควตาฟรี 10 GB)`);
  console.log('✔ QR ทั้งหมดอยู่ใน qr/ และในคลัง QR ของ npm run mkt:studio');
})().catch(e => { console.error('✖', e); process.exit(1); });
