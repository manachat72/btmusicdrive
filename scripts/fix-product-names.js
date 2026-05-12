// One-time script to clean up product names in DB
// Run: node scripts/fix-product-names.js
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require(path.join(__dirname, '..', 'server', 'node_modules', '@prisma', 'client'));

const dotenvPath = path.join(__dirname, '..', 'server', '.env.local');
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
// Neon pooler ใช้ไม่ได้จาก local script — เปลี่ยนเป็น direct URL
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('-pooler.', '.');
}

const RENAMES = [
  { slug: 'usb-flash-drive-mp3-ephl',                  name: 'USB แฟลชไดรฟ์ MP3 รวมเพลงลูกทุ่ง ฟังในรถ' },
  { slug: 'usb-mp3-string-90s',                        name: 'USB แฟลชไดรฟ์ MP3 รวมเพลงสตริงยุค 90 ฮิตตลอดกาล' },
  { slug: 'usb-mp3-luk-thung-indy-4gb',                name: 'USB แฟลชไดรฟ์ MP3 รวมเพลงลูกทุ่งอินดี้ ฟังในรถ' },
  { slug: 'usb-mp3-isan-indy',                         name: 'USB แฟลชไดรฟ์ MP3 รวมเพลงอีสานอินดี้ ลูกทุ่งใหม่' },
  { slug: 'usb-mp3-luk-thung-100',                     name: 'USB แฟลชไดรฟ์ MP3 รวมเพลงลูกทุ่งฮิต ฟังในรถยนต์' },
  { slug: 'usb-mp3-carabao-4gb',                       name: 'USB แฟลชไดรฟ์ MP3 เพลงเพื่อชีวิต คาราบาว ครบทุกอัลบั้ม' },
  { slug: 'usb-mp3-got-jakrapat',                      name: 'USB แฟลชไดรฟ์ MP3 รวมเพลงลูกทุ่ง ก็อต จักรพรรณ์' },
  { slug: 'usb-mp3-santi-duangsaw',                    name: 'USB แฟลชไดรฟ์ MP3 รวมเพลงสันติ ดวงสว่าง เพลงอมตะ' },
  { slug: 'usb-mp3-luk-krung-4gb',                     name: 'USB แฟลชไดรฟ์ MP3 รวมเพลงลูกกรุง เพลงอมตะ ฟังในรถ' },
  { slug: 'usb-mp3-carabao-2gb',                       name: 'USB แฟลชไดรฟ์ MP3 รวมเพลงคาราบาว ครบทุกอัลบั้ม' },
  { slug: 'usb-mp3-thai-rock-2000',                    name: 'USB แฟลชไดรฟ์ MP3 รวมเพลงร็อคไทย ยุค 2000 เพลงฮิต' },
];

(async () => {
  const prisma = new PrismaClient();
  try {
    for (const { slug, name } of RENAMES) {
      const updated = await prisma.product.updateMany({
        where: { slug },
        data: { name },
      });
      if (updated.count > 0) {
        console.log(`✓ ${slug}`);
      } else {
        console.warn(`✗ ไม่พบ slug: ${slug}`);
      }
    }
    console.log('\nเสร็จแล้ว — run sync-products-json.js เพื่ออัพเดท products.json');
  } finally {
    await prisma.$disconnect();
  }
})();
