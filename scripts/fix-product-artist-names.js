// scripts/fix-product-artist-names.js
// Remove specific artist/band names from product descriptions (copyright-safe)
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'products.json');
const products = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// [pattern, replacement] — string or regex
const fixes = {

  // ── กลุ่ม 1: Multi-artist compilations ──────────────────────────────────
  'usb-flash-drive-mp3-90s-greatest-hits': [
    ['รวมศิลปินดัง Backstreet Boys, Westlife, Maroon 5 และอีกมากมาย',
     'รวมศิลปินดังมากมาย'],
  ],
  'usb-flash-drive-mp3-includes-songs-from-the-90s': [
    ['ครบทุกวง Clash, Potato, Bodyslam, AB Normal, ปาล์มมี่ และอีกมากมาย',
     'รวมเพลงฮิตจากหลากหลายศิลปินดัง'],
  ],
  'usb-mp3-southern-memories-original': [
    [/จากศิลปินชื่อดัง เช่น หลวงไก่[^<]*/g,
     'จากศิลปินชื่อดังภาคใต้มากมาย'],
    ['ลาบานูน ไฟล์', 'ไฟล์'],
  ],
  'usb-mp3-luk-krung-amata': [
    [/เช่น สุนทราภรณ์[^<]*/g,
     'จากศิลปินระดับตำนานแห่งวงการลูกกรุงไทย'],
  ],
  'usb-mp3-luk-thung-amata': [
    [/เช่น สายัณห์[^<]*/g,
     'จากศิลปินลูกทุ่งระดับตำนาน'],
  ],
  'usb-mp3-kru-sla': [
    [/เช่น ไมค์ ภิรมย์พร[^<]*/g,
     'จากศิลปินลูกทุ่งยอดนิยมมากมาย'],
  ],
  'usb-mp3-phuea-chiwit-2': [
    [/เช่น คาราบาว[^<]*/g,
     'จากศิลปินเพื่อชีวิตระดับตำนานของไทย'],
  ],

  // ── กลุ่ม 2: Single-artist products ─────────────────────────────────────
  'usb-mp3-luk-krung-suntharaporn': [
    // description mentions: สุนทราภรณ์ ชรินทร์ นันทิดา สวลี
    [/สุนทราภรณ์ ชรินทร์ นันทิดา สวลี/g,
     'วงออเคสตร้าไทยในตำนานและศิลปินระดับปรมาจารย์'],
    [/สุนทราภรณ์/g, 'วงออเคสตร้าไทยในตำนาน'],
  ],
  'usb-flash-drive-mp3-includes-labanun-songs': [
    ['รวมเพลงlabanun 1GB รวม 92 เพลง ลาบานูน',
     'รวมเพลงสตริงฮิต 1GB รวม 92 เพลง'],
    [/ลาบานูน/g, 'ศิลปินยอดนิยม'],
  ],
  'usb-mp3-phuea-chiwit-carabao-4gb-325-songs': [
    ['USB แฟลชไดรฟ์ MP3 เพลงเพื่อชีวิต คาราบาว 2GB',
     'USB แฟลชไดรฟ์ MP3 เพลงเพื่อชีวิต 2GB'],
    ['รวมเพลงคาราบาว MP3 ครบทุกอัลบั้ม',
     'รวมเพลงเพื่อชีวิตฮิต MP3 ครบทุกอัลบั้ม'],
    [/คาราบาว/g, 'ศิลปินเพื่อชีวิตในตำนาน'],
  ],
  'usb-mp3-carabao-2gb': [
    [/"คาราบาว"/g, '"ศิลปินเพื่อชีวิตในตำนาน"'],
    [/คาราบาว/g, 'ศิลปินเพื่อชีวิตในตำนาน'],
  ],
  'usb-mp3-bodyslam': [
    ['รวมทุกเพลง Bodyslam ครบทุกอัลบั้ม',
     'รวมเพลงร็อคฮิตครบทุกอัลบั้ม'],
    [/Bodyslam/g, 'ศิลปินร็อคในตำนาน'],
  ],
  'usb-mp3-pongsit-kampee': [
    ['รวมเพลง พงษ์สิทธิ์ คำภีร์ ครบทุกอัลบั้มตั้งแต่ชุดแรกจนถึงปัจจุบัน 2530-2566',
     'รวมเพลงเพื่อชีวิตฮิตครบทุกอัลบั้มตั้งแต่ยุคเริ่มต้นจนถึงปัจจุบัน'],
    [/พงษ์สิทธิ์ คำภีร์/g, 'ศิลปินเพื่อชีวิตระดับตำนาน'],
    [/พงษ์สิทธิ์/g, 'ศิลปินเพื่อชีวิตระดับตำนาน'],
  ],
};

let changed = 0;
for (const prod of products) {
  const fix = fixes[prod.slug];
  if (!fix) continue;
  let desc = prod.description || '';
  const original = desc;
  for (const [pattern, replacement] of fix) {
    desc = desc.replace(pattern, replacement);
  }
  if (desc !== original) {
    prod.description = desc;
    changed++;
    console.log('Fixed:', prod.slug);
  }
}

fs.writeFileSync(filePath, JSON.stringify(products, null, 2), 'utf8');
console.log(`\nDone: ${changed} products updated`);
