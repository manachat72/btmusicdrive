// ตั้งรูปปกใหม่ (images/products1) เป็นภาพแรกของสินค้าใน DB
// รัน: node scripts/set-product-covers.js          -> dry-run (อ่านอย่างเดียว)
//      node scripts/set-product-covers.js --apply  -> เขียนจริง
//
// วิธีทำงาน: ตั้ง imageUrl = รูปใหม่ และ prepend เข้า images[] "ของ DB เอง"
// โดยไม่แตะรูปที่ 2 เป็นต้นไป (images[] ใน DB กับ products.json ไม่ตรงกันบางรายการ
// — บางตัว DB เก็บชื่อไฟล์แบบมี hash ที่ products.json ไม่มี และกลับกัน)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { PrismaClient } = require(path.join(ROOT, 'server', 'node_modules', '@prisma', 'client'));

for (const name of ['.env', '.env.local']) {
  const p = path.join(ROOT, 'server', name);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
}

// slug ของสินค้า -> ชื่อไฟล์รูป (ไม่ใส่นามสกุล) ใน images/products1/
const MAP = {
  'usb-mp3-hits-2000': 'usb-mp3-11-49-23-am',
  'usb-mp3-thai-rock-2000': 'usb-mp3-11-49-45-am',
  'usb-mp3-tai-hit': 'usb-mp3-11-49-36-am',
  'usb-mp3-tai-phroaa': 'usb-mp3-11-50-34-am',
  'usb-mp3-90s-classic': 'usb-mp3-11-49-53-am',
  'usb-mp3-string-90s': 'usb-mp3-11-50-18-am',
  'usb-mp3-pong-pat': 'usb-mp3-11-50-01-am',
  'usb-mp3-international-hits': 'usb-mp3-11-50-08-am',
  'usb-mp3-rock-wan-kao': 'usb-mp3-11-50-23-am',
  'usb-mp3-rock-legend': 'usb-mp3-11-56-02-am',
  'usb-mp3-rock-90s': 'usb-mp3-rock-90',
  'usb-mp3-luk-thung-indy-4gb': 'usb-mp3-11-50-43-am',
  'usb-mp3-isan-indy': 'usb-mp3-11-51-03-am',
  'usb-mp3-luk-krung-amata': 'usb-mp3-11-50-57-am',
  'usb-mp3-hit-nai-rot': 'usb-mp3-11-50-50-am',
};

const APPLY = process.argv.includes('--apply');

(async () => {
  const prisma = new PrismaClient();
  let n = 0, skipped = [];
  try {
    console.log(APPLY ? '=== APPLY (เขียนจริง) ===' : '=== DRY-RUN (ไม่เขียน) ===');
    for (const [slug, stem] of Object.entries(MAP)) {
      const url = `/images/products1/${stem}.webp`;
      if (!fs.existsSync(path.join(ROOT, url))) { skipped.push(`${slug} (ไม่พบไฟล์ ${url})`); continue; }
      const db = await prisma.product.findFirst({ where: { slug }, select: { id: true, imageUrl: true, images: true } });
      if (!db) { skipped.push(`${slug} (ไม่พบใน DB)`); continue; }

      const rest = (db.images || []).filter(u => u !== url);
      n++;
      console.log(`${String(n).padStart(2)} ${slug}`);
      console.log(`   เดิม: ${db.imageUrl || '(null)'}`);
      console.log(`   ใหม่: ${url}  (images: ${rest.length + 1})`);
      if (APPLY) {
        await prisma.product.update({
          where: { id: db.id },
          data: { imageUrl: url, images: [url, ...rest] },
        });
      }
    }
    console.log(`\n${APPLY ? 'อัปเดตแล้ว' : 'จะอัปเดต'}: ${n} รายการ`);
    if (skipped.length) console.log('ข้าม:', skipped);
    if (!APPLY) console.log('\nยังไม่ได้เขียนอะไร — ใส่ --apply เพื่อเขียนจริง');
  } finally {
    await prisma.$disconnect();
  }
})();
