#!/usr/bin/env node
/**
 * สร้างรายละเอียดสินค้าใหม่ (SEO) สำหรับ Shopee — เขียนใหม่ทั้งหมดจากข้อมูลจริง
 *
 * ดึงข้อมูลจาก: marketplace-images/catalog.json + products.json
 * ออกไฟล์:      templates/shopee-descriptions.csv  (Code, ชื่อสินค้า, ความจุ, จำนวนเพลง, รายละเอียด)
 *
 * สคริปต์ fill-shopee-template.js จะอ่านไฟล์นี้ไปเติมช่อง "รายละเอียดสินค้า" อัตโนมัติ
 * แก้ข้อความในไฟล์ CSV ได้ตามใจ แล้วรัน npm run mkt:shopee ซ้ำ
 *
 * Usage:
 *   node scripts/generate-shopee-descriptions.js            # dry-run (โชว์ตัวอย่าง 1 รายการ)
 *   node scripts/generate-shopee-descriptions.js --apply
 *   node scripts/generate-shopee-descriptions.js --apply --force   # เขียนทับของเดิม
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'templates');
const OUT_FILE = path.join(OUT_DIR, 'shopee-descriptions.csv');

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');

const MAX_LEN = 2900;   // Shopee จำกัด 3000 ตัวอักษร เผื่อไว้

// ── ตรวจแนวเพลงจากชื่อสินค้า → ใช้ทำคีย์เวิร์ด ──
const GENRES = [
  { re: /เพื่อชีวิต|คาราบาว|พงษ์สิทธิ์|คำภีร์|มาลีฮวนน่า/, name: 'เพื่อชีวิต', kw: ['เพลงเพื่อชีวิต', 'คาราบาว', 'เพลงเพื่อชีวิตเก่า'] },
  { re: /ลูกทุ่ง|หมอลำ|อีสาน|พุ่มพวง|ก็อต ?จักรพรรณ์|ครูสลา/, name: 'ลูกทุ่ง', kw: ['เพลงลูกทุ่ง', 'ลูกทุ่งเก่า', 'ลูกทุ่งฮิต'] },
  { re: /ลูกกรุง|สุนทราภรณ์|สันติ ?ดวงสว่าง/, name: 'ลูกกรุง', kw: ['เพลงลูกกรุง', 'เพลงเก่าอมตะ', 'สุนทราภรณ์'] },
  { re: /ใต้|สตอ|สำเนียงใต้/, name: 'เพลงใต้', kw: ['เพลงใต้', 'เพลงใต้เก่า', 'สำเนียงใต้'] },
  { re: /ร็อค|โลโซ|เสก|bodyslam|บอดี้สแลม|พงษ์พัฒน์|ลาบานูน/i, name: 'ร็อคไทย', kw: ['เพลงร็อค', 'ร็อคไทย', 'ร็อคยุค 90'] },
  { re: /สากล|international|ฮิตติดชาร์ต/i, name: 'สากล', kw: ['เพลงสากล', 'เพลงสากลเก่า', 'เพลงฮิตสากล'] },
  { re: /แดนซ์|dance|มันส์/i, name: 'แดนซ์', kw: ['เพลงแดนซ์', 'เพลงมันส์', 'เพลงปาร์ตี้'] },
  { re: /ธรรมะ|สวดมนต์|คาถา|นิยายเสียง|อาจารย์ยอด|เพ็ญศรี/, name: 'ธรรมะ', kw: ['ธรรมะ', 'เสียงสวดมนต์', 'ฟังธรรมะ'] },
  { re: /สตริง|ยุค ?90|ยุค ?80|ยุค ?2000|tiktok|100 ?ล้านวิว/i, name: 'สตริง', kw: ['เพลงสตริง', 'เพลงเก่า', 'เพลงฮิตยุค 90'] },
  { re: /3 ?ช่า|สามช่า/, name: '3 ช่า', kw: ['เพลง 3 ช่า', 'สามช่า', 'เพลงมันส์'] },
];

const ACCESSORY = /otg|หัวแปลง|วิทยุ|adapter/i;

function detectGenre(name) {
  return GENRES.find(g => g.re.test(name)) || { name: 'เพลงฮิต', kw: ['เพลงฮิต', 'รวมเพลง', 'เพลงเพราะ'] };
}

function detectEra(name) {
  const m = name.match(/ยุค ?(\d{2,4})|(\d{2,4})\s*s\b/i);
  return m ? (m[1] || m[2]) : null;
}

function detectCapacity(name, fallback = '4GB') {
  const m = name.match(/(\d+)\s*(gb|จิกะ|กิกะ)/i);
  return m ? `${m[1]}GB` : fallback;
}

function songCount(prod, name) {
  if (prod?.tracklist?.length) return prod.tracklist.length;
  const m = name.match(/(\d{2,4})\s*\+?\s*เพลง/);
  return m ? parseInt(m[1], 10) : null;
}

// ── ตัวสร้างข้อความ ──

function buildMusic({ name, genre, era, capacity, songs }) {
  const n = songs ? `${songs} เพลง` : 'เพลงฮิตจัดเต็ม';
  const eraTxt = era ? `ยุค ${era} ` : '';

  return [
`${name}

รวม${genre.name} ${eraTxt}${n} อัดลงแฟลชไดรฟ์ USB พร้อมฟัง เสียบปุ๊บเล่นปั๊บ ไม่ต้องต่อเน็ต ไม่ต้องโหลดแอป ไม่มีโฆษณาคั่น

✅ จุดเด่น
• คัดเพลงมาแล้ว ${n} — ไม่ต้องเสียเวลาหาเอง
• ไฟล์ MP3 320kbps เสียงคมชัด เบสแน่น ฟังในรถก็ได้อารมณ์เต็ม
• เสียบใช้ได้ทันที รองรับเครื่องเสียงรถยนต์ · ลำโพงบลูทูธที่มีช่อง USB · คอม · สมาร์ททีวี
• ตั้งชื่อไฟล์เรียงเลขเป็นระเบียบ เลื่อนหาเพลงง่าย
• มีปกสวย พร้อมรายชื่อเพลงครบทุกแทร็ก
• เพิ่ม–ลบเพลงเองได้ ใช้เป็นแฟลชไดรฟ์เก็บไฟล์ทั่วไปต่อได้

📀 รายละเอียดสินค้า
• ความจุ: ${capacity}
• จำนวนเพลง: ${n}
• คุณภาพเสียง: MP3 320kbps
• ประเภท: Flash Drive (USB)
• แนวเพลง: ${genre.name}${era ? ` ยุค ${era}` : ''}

🎧 ใช้กับอะไรได้บ้าง
รถยนต์ทุกรุ่นที่มีช่อง USB · ลำโพงพกพา/ลำโพงล้อลาก · เครื่องเสียงบ้าน · คอมพิวเตอร์และโน้ตบุ๊ก · สมาร์ททีวี · เครื่องเล่น MP3

📦 การจัดส่ง
ส่งจากไทย พร้อมส่งทันที แพ็กกันกระแทกอย่างดี ได้รับภายใน 1–3 วันทำการ

❓ คำถามที่พบบ่อย
• เสียบแล้วเล่นได้เลยไหม — ได้เลย ไม่ต้องตั้งค่าอะไรเพิ่ม
• มีไวรัสไหม — สแกนทุกชิ้นก่อนจัดส่ง ปลอดภัย 100%
• เพิ่มเพลงเองได้ไหม — ได้ ใช้งานเหมือนแฟลชไดรฟ์ทั่วไป
• สินค้ามีปัญหาทำอย่างไร — เปลี่ยนใหม่ภายใน 7 วัน

🔎 ${[...genre.kw, `แฟลชไดรฟ์เพลง`, `usb mp3`, `เพลงในรถ`, `แฟลชไดรฟ์ ${capacity}`, era ? `เพลงยุค ${era}` : 'เพลงเก่าเพราะๆ'].join(' · ')}`
  ].join('').trim();
}

function buildAccessory({ name }) {
  return `${name}

อุปกรณ์เสริมที่ใช้คู่กับแฟลชไดรฟ์ MP3 ได้พอดี ใช้งานง่าย พกพาสะดวก

✅ จุดเด่น
• คุณภาพดี ทนทาน ใช้งานได้ยาว
• ขนาดกะทัดรัด พกใส่กระเป๋าได้สบาย
• ติดตั้งง่าย ใช้ได้ทันที ไม่ต้องลงโปรแกรม

📦 การจัดส่ง
ส่งจากไทย พร้อมส่งทันที แพ็กกันกระแทกอย่างดี ได้รับภายใน 1–3 วันทำการ

❓ คำถามที่พบบ่อย
• สินค้ามีปัญหาทำอย่างไร — เปลี่ยนใหม่ภายใน 7 วัน
• มีคู่มือไหม — ใช้งานง่าย เสียบใช้ได้เลย

🔎 อุปกรณ์เสริม · usb · แฟลชไดรฟ์ · อุปกรณ์เก็บข้อมูล`;
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// ── main ──
(() => {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'marketplace-images', 'catalog.json'), 'utf8')).products;
  const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));

  const norm = (s) => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const sim = (a, b) => {
    if (!a || !b) return 0;
    const bg = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
    const A = bg(a), B = bg(b); let inter = 0;
    for (const [g, n] of A) if (B.has(g)) inter += Math.min(n, B.get(g));
    const t = [...A.values()].reduce((x, y) => x + y, 0) + [...B.values()].reduce((x, y) => x + y, 0);
    return t ? 2 * inter / t : 0;
  };

  if (fs.existsSync(OUT_FILE) && APPLY && !FORCE) {
    console.error('✖ มี templates/shopee-descriptions.csv อยู่แล้ว — ใส่ --force ถ้าต้องการเขียนทับ');
    process.exit(1);
  }

  const rows = [['Code', 'ชื่อสินค้า', 'ความจุ', 'จำนวนเพลง', 'รายละเอียด']];
  let over = 0;

  for (const p of catalog) {
    const t = norm(p.title);
    let prod = null, best = 0;
    for (const x of products) { const s = sim(t, norm(x.name)); if (s > best) { best = s; prod = x; } }
    if (best < 0.5) prod = null;

    const name = prod?.name || p.title;
    const songs = songCount(prod, `${name} ${p.title}`);
    const capacity = detectCapacity(`${name} ${p.title}`);
    const genre = detectGenre(`${name} ${p.title}`);
    const era = detectEra(`${name} ${p.title}`);

    let desc = ACCESSORY.test(name)
      ? buildAccessory({ name })
      : buildMusic({ name, genre, era, capacity, songs });

    if (desc.length > MAX_LEN) { desc = desc.slice(0, MAX_LEN); over++; }

    rows.push([p.code, name, capacity, songs || '', desc]);
  }

  console.log(`สร้างรายละเอียด ${rows.length - 1} รายการ${over ? ` (ตัดให้สั้นลง ${over} รายการ)` : ''}`);
  console.log('\n──────── ตัวอย่าง (รายการแรก) ────────\n');
  console.log(rows[1][4]);
  console.log('\n─────────────────────────────────────');
  console.log(`ความยาว ${rows[1][4].length} ตัวอักษร (จำกัด 3000)`);

  if (!APPLY) { console.log('\n(dry run — ใส่ --apply เพื่อเขียนไฟล์)'); return; }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n', 'utf8');
  console.log(`\n✔ templates/shopee-descriptions.csv`);
  console.log('  แก้ข้อความในไฟล์ได้ตามใจ แล้วรัน npm run mkt:shopee');
})();
