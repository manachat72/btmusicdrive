// One-off: fix the "suat-mon" product wording in the live DB so customers
// understand it is sung chant-music, not real monk chanting.
// Run dry:  node scripts/fix-suat-mon-wording.js
// Apply:    node scripts/fix-suat-mon-wording.js --apply
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '..', 'server', 'node_modules', '@prisma', 'client'));

for (const envFile of ['.env', '.env.local']) {
  const p = path.join(__dirname, '..', 'server', envFile);
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

const SLUG = 'usb-mp3-suat-mon';
const NAME = 'USB แฟลชไดรฟ์ mp3 - เพลงบทสวดมนต์ทำนองดนตรี รวมคาถามงคล ฟังเสริมสิริมงคล';

// Apply the same text replacements we made in products.json to the DB description.
const REPLACEMENTS = [
  [
    'USB แฟลชไดรฟ์ - บทสวดมนต์ รวบรวมบทสวดมนต์ คาถามงคล ฟังง่าย เสียงคมชัด เหมาะสำหรับใช้ในการปฏิบัติธรรม สวดมนต์ก่อนนอน เปิดฟังเสริมสิริมงคล หรือใช้ในพิธีกรรมทางศาสนา',
    'USB แฟลชไดรฟ์ - เพลงบทสวดมนต์ รวบรวมบทสวดมนต์และคาถามงคลในรูปแบบเพลงขับร้องประกอบดนตรีบรรเลง (ไม่ใช่เสียงพระสวดในพิธี) ฟังง่าย เสียงคมชัด ทำนองไพเราะ เหมาะสำหรับเปิดฟังผ่อนคลาย ฟังก่อนนอน เปิดในรถ หรือเปิดฟังเสริมสิริมงคล',
  ],
  [
    'รวม บทสวดมนต์และคาถามงคล กว่า 20+ บท',
    'รวมเพลงบทสวดมนต์และคาถามงคลขับร้องประกอบดนตรี กว่า 20+ บท',
  ],
];

(async () => {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  try {
    const p = await prisma.product.findUnique({ where: { slug: SLUG } });
    if (!p) throw new Error(`Product not found: ${SLUG}`);

    let desc = p.description || '';
    const hits = [];
    for (const [from, to] of REPLACEMENTS) {
      if (desc.includes(from)) {
        desc = desc.split(from).join(to);
        hits.push(from.slice(0, 40) + '…');
      }
    }

    console.log('Slug   :', SLUG);
    console.log('Name   :', p.name === NAME ? '(already updated)' : `"${p.name}" -> "${NAME}"`);
    console.log('Desc replacements matched:', hits.length, hits);
    console.log('Mode   :', apply ? 'APPLY' : 'DRY-RUN (use --apply to write)');

    if (apply) {
      await prisma.product.update({ where: { slug: SLUG }, data: { name: NAME, description: desc } });
      console.log('✅ DB updated.');
    }
  } finally {
    await prisma.$disconnect();
  }
})();
