#!/usr/bin/env node
/**
 * สร้างไฟล์ลงสินค้า (xlsx) พร้อม SEO แยกตามแพลตฟอร์ม — Shopee / Lazada / TikTok Shop / เว็บ
 *
 * แหล่งข้อมูล:
 *   1. marketplace-images/catalog.json     → รหัสสินค้า + ลิงก์รูปกลางบน R2 (ภาพปก + รูป 1-8)
 *   2. products.json                       → ชื่อ, ราคา, SKU, สต็อก, tracklist
 *   3. templates/shopee-descriptions.csv   → รายละเอียด Shopee ที่เขียนไว้แล้ว (ถ้ามี)
 *
 * ออกไฟล์: templates/marketplace-listings.xlsx (4 ชีต: Shopee / Lazada / TikTok Shop / Website)
 * แต่ละชีตมี ชื่อสินค้า SEO + รายละเอียด + Tags ตามสไตล์ของแพลตฟอร์มนั้น พร้อมลิงก์รูปครบ
 * → เปิดไฟล์ copy ลงเทมเพลต mass upload ของแต่ละเจ้าได้เลย
 *
 * Usage:
 *   node scripts/generate-marketplace-listings.js            # dry-run (โชว์ตัวอย่าง)
 *   node scripts/generate-marketplace-listings.js --apply    # เขียนไฟล์
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'templates');
const OUT_FILE = path.join(OUT_DIR, 'marketplace-listings.xlsx');

const APPLY = process.argv.includes('--apply');

// ═══ ตั้งค่าร้าน — แก้ตรงนี้ที่เดียว ═══
const CONFIG = {
  price: 279,        // ราคาเดียวทุกรายการ (ใส่ null ถ้าอยากใช้ราคาจาก products.json)
  stock: 100,
  weight: 1,         // กก. (หน่วยตามเทมเพลต Shopee เดิม)
  length: 10, width: 10, height: 10,   // ซม.
  brand: 'btmusicdrive',
  shopUrl: 'https://btmusicdrive.com',
  shopeeCategoryId: 101964,   // เลขหมวดหมู่ Shopee (แฟลชไดรฟ์)
};

// ── ข้อจำกัดต่อแพลตฟอร์ม ──
const LIMIT = {
  shopee: { title: 120, desc: 3000 },
  lazada: { title: 255, desc: 10000 },
  tiktok: { title: 255, desc: 10000, minImages: 5 },
  web: { title: 60, meta: 160 },
};

// ── ตรวจแนวเพลงจากชื่อสินค้า → ใช้ทำคีย์เวิร์ด ──
const GENRES = [
  { re: /เพื่อชีวิต|คาราบาว|พงษ์สิทธิ์|คำภีร์|มาลีฮวนน่า/, name: 'เพื่อชีวิต', kw: ['เพลงเพื่อชีวิต', 'เพลงเพื่อชีวิตเก่า', 'เพลงในตำนาน'], tag: 'เพลงเพื่อชีวิต' },
  { re: /ลูกทุ่ง|หมอลำ|อีสาน|พุ่มพวง|ก็อต ?จักรพรรณ์|ครูสลา/, name: 'ลูกทุ่ง', kw: ['เพลงลูกทุ่ง', 'ลูกทุ่งเก่า', 'ลูกทุ่งฮิต'], tag: 'เพลงลูกทุ่ง' },
  { re: /ลูกกรุง|สุนทราภรณ์|สันติ ?ดวงสว่าง/, name: 'ลูกกรุง', kw: ['เพลงลูกกรุง', 'เพลงเก่าอมตะ', 'เพลงอมตะ'], tag: 'เพลงลูกกรุง' },
  { re: /ใต้|สตอ|สำเนียงใต้/, name: 'เพลงใต้', kw: ['เพลงใต้', 'เพลงใต้เก่า', 'สำเนียงใต้'], tag: 'เพลงใต้' },
  { re: /ร็อค|โลโซ|เสก|bodyslam|บอดี้สแลม|พงษ์พัฒน์|ลาบานูน/i, name: 'ร็อคไทย', kw: ['เพลงร็อค', 'ร็อคไทย', 'ร็อคยุค 90'], tag: 'เพลงร็อค' },
  { re: /สากล|international|ฮิตติดชาร์ต/i, name: 'สากล', kw: ['เพลงสากล', 'เพลงสากลเก่า', 'เพลงฮิตสากล'], tag: 'เพลงสากล' },
  { re: /แดนซ์|dance|มันส์/i, name: 'แดนซ์', kw: ['เพลงแดนซ์', 'เพลงมันส์', 'เพลงปาร์ตี้'], tag: 'เพลงแดนซ์' },
  { re: /ธรรมะ|สวดมนต์|คาถา|นิยายเสียง|อาจารย์ยอด|เพ็ญศรี/, name: 'ธรรมะ', kw: ['ธรรมะ', 'เสียงสวดมนต์', 'ฟังธรรมะ'], tag: 'ธรรมะ' },
  { re: /สตริง|ยุค ?90|ยุค ?80|ยุค ?2000|tiktok|100 ?ล้านวิว/i, name: 'สตริง', kw: ['เพลงสตริง', 'เพลงเก่า', 'เพลงฮิตยุค 90'], tag: 'เพลงสตริง' },
  { re: /3 ?ช่า|สามช่า/, name: '3 ช่า', kw: ['เพลง 3 ช่า', 'สามช่า', 'เพลงมันส์'], tag: 'เพลงสามช่า' },
];
const ACCESSORY = /otg|หัวแปลง|วิทยุ|adapter/i;

const detectGenre = (n) => GENRES.find(g => g.re.test(n)) || { name: 'เพลงฮิต', kw: ['เพลงฮิต', 'รวมเพลง', 'เพลงเพราะ'], tag: 'เพลงฮิต' };
const detectEra = (n) => { const m = n.match(/ยุค ?(\d{2,4})|(\d{2,4})\s*s\b/i); return m ? (m[1] || m[2]) : null; };
const detectCapacity = (n) => { const m = n.match(/(\d+)\s*(gb|จิกะ|กิกะ)/i); return m ? `${m[1]}GB` : '4GB'; };
const songCount = (prod, n) => {
  if (prod?.tracklist?.length) return prod.tracklist.length;
  const m = n.match(/(\d{2,4})\s*\+?\s*(?:เพลง|ตอน|เรื่อง)/);
  return m ? parseInt(m[1], 10) : null;
};

// คำนามเนื้อหา (เพลง/เรื่องเล่า/ธรรมะ) — ใช้ตารางเดียวกับ seo.js ห้ามก๊อปคำมาไว้ 2 ที่
const { contentFromName } = require('./lib/seo');

// ── helpers ──
const norm = (s) => String(s ?? '').toLowerCase().replace(/[​﻿]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const bg = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const A = bg(a), B = bg(b); let inter = 0;
  for (const [g, n] of A) if (B.has(g)) inter += Math.min(n, B.get(g));
  const t = [...A.values()].reduce((x, y) => x + y, 0) + [...B.values()].reduce((x, y) => x + y, 0);
  return t ? 2 * inter / t : 0;
}

/** ตัดข้อความไม่ให้เกิน limit โดยตัดที่ขอบคำ */
function clip(s, max) {
  s = String(s ?? '').replace(/\s{2,}/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trim();
}

/** ตัดคำนำหน้าซ้ำ ๆ ("USB แฟลชไดรฟ์ - MP3 …") ออกจากชื่อ เหลือแก่นของสินค้า */
function coreName(name) {
  return String(name)
    .replace(/^usb[\s\-–—]*(แฟลชไดรฟ์|flash\s*drive)?[\s\-–—]*(mp3)?[\s\-–—]*/i, '')
    // ตัดหางมาตรฐานที่ buildSeo() ต่อไว้แล้ว (จำนวน/ความจุ/สโลแกน)
    // ไม่ตัด = เทมเพลตข้างล่างเติมซ้ำอีกรอบ กลายเป็น "461 ตอน 16GB ฟังในรถ … 461 เพลง 16GB ฟังในรถ"
    .replace(/\s*\d{1,4}\s*(เพลง|ตอน|เรื่อง)(?![ก-๙])/g, ' ')   // \b ใช้ไม่ได้กับอักษรไทย (JS \w = ASCII)
    .replace(/\s*\d+\s*(GB|MB|TB)\b/gi, ' ')
    .replace(/\s*(ฟังในรถ|ไม่ต้องใช้เน็ต|ไม่ใช้เน็ต|ไม่ต้องต่อเน็ต|ไม่ง้อเน็ต)\s*/g, ' ')
    .replace(/\s{2,}/g, ' ').trim() || String(name).trim();
}

// ── ตัวสร้างชื่อสินค้า SEO ต่อแพลตฟอร์ม ──

function shopeeTitle(x) {
  if (x.accessory) return clip(x.name, LIMIT.shopee.title);
  const songs = x.songs ? `${x.songs} ${x.content.unit}` : `${x.content.noun}จัดเต็ม`;
  return clip(`USB ${x.content.noun} แฟลชไดรฟ์ MP3 ${x.core} ${songs} ${x.capacity} ฟังในรถ ไม่ใช้เน็ต`, LIMIT.shopee.title);
}

function lazadaTitle(x) {
  if (x.accessory) return clip(x.name, LIMIT.lazada.title);
  const songs = x.songs ? `${x.songs} ${x.content.unit}` : `${x.content.noun}จัดเต็ม`;
  return clip(`USB ${x.content.noun} MP3 ${x.core} ${songs} แฟลชไดรฟ์ ${x.capacity} เสียงชัด 320kbps ฟังในรถ คอม เครื่องเสียง ไม่ต้องต่อเน็ต พร้อมส่ง`, LIMIT.lazada.title);
}

function tiktokTitle(x) {
  if (x.accessory) return clip(x.name, LIMIT.tiktok.title);
  const songs = x.songs ? `${x.songs} ${x.content.unit}` : `${x.content.noun}จัดเต็ม`;
  return clip(`เสียบปุ๊บฟังปั๊บ! USB ${x.content.noun} ${x.core} ${songs} ฟังในรถไม่ง้อเน็ต ไม่มีโฆษณาคั่น แฟลชไดรฟ์ ${x.capacity}`, LIMIT.tiktok.title);
}

// ── ตัวสร้างรายละเอียดต่อแพลตฟอร์ม ──

function lazadaDesc(x) {
  if (x.accessory) {
    return `${x.name}

อุปกรณ์เสริมที่ใช้คู่กับแฟลชไดรฟ์ MP3 ได้พอดี คุณภาพดี ทนทาน ติดตั้งง่าย ใช้ได้ทันทีไม่ต้องลงโปรแกรม

ในกล่องประกอบด้วย: ${x.name} x1

ส่งจากไทย แพ็กกันกระแทกอย่างดี ได้รับภายใน 1-3 วันทำการ สินค้ามีปัญหาเปลี่ยนใหม่ภายใน 7 วัน`;
  }
  const songs = x.songs ? `${x.songs} ${x.content.unit}` : `${x.content.noun}จัดเต็ม`;
  const eraTxt = x.era ? `ยุค ${x.era} ` : '';
  return `รวม${x.genre.name} ${eraTxt}${songs} อัดลงแฟลชไดรฟ์ USB พร้อมฟังทันที เสียบกับรถยนต์ คอมพิวเตอร์ หรือเครื่องเสียงที่มีช่อง USB ได้เลย ไม่ต้องต่ออินเทอร์เน็ต ไม่ต้องโหลดแอป ไม่มีโฆษณาคั่น

จุดเด่น
• คัด${x.content.noun}มาให้แล้ว ${songs} — ไม่ต้องเสียเวลาหาเอง
• ไฟล์ MP3 320kbps เสียงคมชัด เบสแน่น ฟังในรถได้อารมณ์เต็ม
• ใช้ได้กับรถยนต์ทุกรุ่นที่มีช่อง USB, ลำโพงบลูทูธ, คอม, สมาร์ททีวี
• ตั้งชื่อไฟล์เรียงเลขเป็นระเบียบ เลื่อนหา${x.content.noun}ง่าย
• เพิ่ม-ลบไฟล์เองได้ ใช้เป็นแฟลชไดรฟ์เก็บไฟล์ต่อได้

สเปกสินค้า
• ความจุ: ${x.capacity}
• จำนวน${x.content.unit}: ${songs}
• คุณภาพเสียง: MP3 320kbps
• ประเภท: ${x.genre.name}${x.era ? ` ยุค ${x.era}` : ''}

ในกล่องประกอบด้วย: แฟลชไดรฟ์ USB ${x.capacity} พร้อม${x.content.noun} x1

การจัดส่ง: ส่งจากไทย พร้อมส่งทันที แพ็กกันกระแทกอย่างดี ได้รับภายใน 1-3 วันทำการ
รับประกัน: สินค้ามีปัญหาเปลี่ยนใหม่ภายใน 7 วัน สแกนไวรัสทุกชิ้นก่อนส่ง`;
}

function tiktokDesc(x) {
  if (x.accessory) {
    return `${x.name} — ตัวช่วยที่คนใช้ USB เพลงต้องมี! คุณภาพดี ทนทาน เสียบใช้ได้เลยไม่ต้องตั้งค่า ส่งไวจากไทย กดสั่งเลย 🛒`;
  }
  const songs = x.songs ? `${x.songs} ${x.content.unit}` : `${x.content.noun}จัดเต็ม`;
  return `เบื่อไหม? อยาก${x.content.listen}ในรถแต่เน็ตหมด สัญญาณหาย โฆษณาคั่นตลอด 😩

USB ${x.content.noun}ตัวนี้จบทุกปัญหา — ${x.genre.name}${x.era ? ` ยุค ${x.era}` : ''} ${songs} อัดแน่นในแฟลชไดรฟ์ ${x.capacity} เสียบปุ๊บฟังได้ปั๊บ!

✅ ${songs} คัดมาแล้ว ไม่ต้องหาเอง
✅ เสียงชัด MP3 320kbps เบสแน่น
✅ ใช้ได้ทั้งรถ คอม ลำโพง สมาร์ททีวี
✅ ไม่ต้องเน็ต ไม่มีรายเดือน ไม่มีโฆษณา
✅ เป็นของขวัญให้พ่อแม่ผู้ใหญ่ก็เหมาะมาก ใช้ง่าย ไม่ต้องสอน

ส่งไวจากไทย 1-3 วันถึง มีปัญหาเปลี่ยนใหม่ใน 7 วัน
ของพร้อมส่ง กดสั่งเลยก่อนหมด 🛒🔥`;
}

function webSeo(x) {
  const songs = x.songs ? `${x.songs} ${x.content.unit}` : x.content.noun;
  if (x.accessory) {
    return {
      title: clip(`${x.name} | btmusicdrive`, LIMIT.web.title),
      meta: clip(`${x.name} อุปกรณ์เสริมสำหรับ USB เพลง คุณภาพดี ใช้งานง่าย ส่งไวทั่วไทย สั่งได้เลยวันนี้`, LIMIT.web.meta),
      h1: x.name,
    };
  }
  return {
    title: clip(`USB ${x.content.noun}${x.genre.name} ${songs} ฟังในรถไม่ต้องเน็ต | btmusicdrive`, LIMIT.web.title),
    meta: clip(`USB ${x.content.noun}${x.genre.name}พร้อมฟัง ${songs} เสียงชัด MP3 320kbps ใช้ได้ในรถ คอม เครื่องเสียง ไม่ต้องต่อเน็ต ไม่มีรายเดือน สั่งวันนี้ส่งไว`, LIMIT.web.meta),
    h1: `USB ${x.content.noun}${x.genre.name}พร้อมฟัง ${songs} — เสียบปุ๊บ ฟังได้ทุกที่ ไม่ต้องเน็ต`,
  };
}

const shopeeTags = (x) => [...x.genre.kw, 'USB เพลง', 'แฟลชไดรฟ์เพลง', 'เพลงในรถ', 'USB MP3', `แฟลชไดรฟ์ ${x.capacity}`, x.era ? `เพลงยุค ${x.era}` : 'เพลงฟังในรถไม่ต้องเน็ต'].slice(0, 10).join(', ');
const tiktokHashtags = (x) => ['#USBเพลง', '#เพลงในรถ', '#แฟลชไดรฟ์เพลง', '#ฟังเพลงไม่ใช้เน็ต', `#${x.genre.tag.replace(/\s+/g, '')}`, '#TikTokShop'].join(' ');

// ── main ──
(() => {
  const catalogPath = path.join(ROOT, 'marketplace-images', 'catalog.json');
  if (!fs.existsSync(catalogPath)) {
    console.error('✖ ไม่พบ marketplace-images/catalog.json — รัน npm run mkt:build ก่อน');
    process.exit(1);
  }
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')).products;
  const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'))
    .map(p => ({ ...p, _norm: norm(p.name) }));

  // รายละเอียด Shopee ที่เขียนไว้แล้ว (Code → รายละเอียด)
  const shopeeDescs = {};
  const descPath = path.join(OUT_DIR, 'shopee-descriptions.csv');
  if (fs.existsSync(descPath)) {
    const wb = XLSX.read(fs.readFileSync(descPath), { type: 'buffer', raw: true });
    for (const r of XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })) {
      const code = String(r.Code ?? r.code ?? '').padStart(2, '0');
      if (code) shopeeDescs[code] = String(r['รายละเอียด'] ?? '');
    }
    console.log(`→ ใช้รายละเอียด Shopee จาก shopee-descriptions.csv (${Object.keys(shopeeDescs).length} รายการ)`);
  } else {
    console.warn('⚠ ไม่พบ shopee-descriptions.csv — ชีต Shopee จะใช้รายละเอียดแบบ Lazada แทน (รัน npm run mkt:desc ก่อนถ้าต้องการ)');
  }

  const imgHead = ['ภาพปก', ...Array.from({ length: 8 }, (_, i) => `รูป ${i + 1}`)];
  const S = [['Code', 'หมวดหมู่ Shopee', 'ชื่อสินค้า (SEO ≤120)', 'รายละเอียด', 'ราคา', 'สต็อก', 'SKU', 'น้ำหนัก(กก.)', 'ยาว', 'กว้าง', 'สูง', 'Tags', ...imgHead, 'จำนวนรูป', 'หมายเหตุ']];
  const L = [['Code', 'ชื่อสินค้า (SEO ≤255)', 'Highlights (Short Description)', 'รายละเอียด', 'What\'s in the box', 'ราคา', 'สต็อก', 'SKU', 'แบรนด์', 'น้ำหนัก(กก.)', 'ยาว', 'กว้าง', 'สูง', ...imgHead, 'จำนวนรูป', 'หมายเหตุ']];
  const T = [['Code', 'ชื่อสินค้า (SEO ≤255)', 'รายละเอียด', 'Hashtags', 'ราคา', 'สต็อก', 'SKU', 'น้ำหนัก(กก.)', 'ยาว', 'กว้าง', 'สูง', ...imgHead, 'จำนวนรูป', 'หมายเหตุ']];
  const W = [['Code', 'ชื่อบนเว็บ (ปัจจุบัน)', 'SEO Title (≤60)', 'Meta Description (≤160)', 'H1 แนะนำ', 'สถานะ', 'คะแนนจับคู่']];

  let warn = 0;
  for (const p of catalog) {
    const t = norm(p.title);
    let prod = null, best = 0;
    for (const x of products) { const s = similarity(t, x._norm); if (s > best) { best = s; prod = x; } }
    const matched = best >= 0.5 ? prod : null;

    const name = String(matched?.name || p.title)
      .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
    const full = `${name} ${p.title}`;
    const x = {
      name,
      core: coreName(name),
      accessory: ACCESSORY.test(name),
      genre: detectGenre(full),
      era: detectEra(full),
      capacity: detectCapacity(full),
      songs: songCount(matched, full),
      content: contentFromName(full),
    };

    const price = CONFIG.price != null ? CONFIG.price : (matched?.price ?? '');
    const sku = matched?.sku || `BT-${p.code}`;
    const imgs = p.images.slice(0, 9);
    const imgCells = [...imgs, ...Array(9 - imgs.length).fill('')];
    const nImg = imgs.length;

    const lzd = clip(lazadaDesc(x), LIMIT.lazada.desc);
    const spDesc = clip(shopeeDescs[p.code] || lzd, LIMIT.shopee.desc);
    const highlights = x.accessory
      ? '• คุณภาพดี ทนทาน\n• ติดตั้งง่าย ใช้ได้ทันที\n• ขนาดกะทัดรัด พกพาสะดวก\n• ส่งไวจากไทย'
      : `• ${x.songs ? `${x.songs} เพลง` : 'เพลงฮิตจัดเต็ม'}คัดมาแล้ว พร้อมฟังทันที\n• MP3 320kbps เสียงคมชัด เบสแน่น\n• ใช้ได้กับรถ คอม เครื่องเสียง สมาร์ททีวี\n• ไม่ต้องต่อเน็ต ไม่มีโฆษณา ไม่มีรายเดือน\n• เพิ่ม-ลบเพลงเองได้ภายหลัง`;
    const box = x.accessory ? `${name} x1` : `แฟลชไดรฟ์ USB ${x.capacity} พร้อมเพลง x1`;

    const tkNote = nImg < LIMIT.tiktok.minImages ? `⚠ รูปมี ${nImg} — TikTok ต้องมีอย่างน้อย ${LIMIT.tiktok.minImages}` : '';
    const matchNote = matched ? '' : '⚠ ไม่พบใน products.json — เช็คชื่อ/ราคาเอง';
    if (tkNote || matchNote) warn++;

    S.push([p.code, CONFIG.shopeeCategoryId, shopeeTitle(x), spDesc, price, CONFIG.stock, sku, CONFIG.weight, CONFIG.length, CONFIG.width, CONFIG.height, shopeeTags(x), ...imgCells, nImg, matchNote]);
    L.push([p.code, lazadaTitle(x), highlights, lzd, box, price, CONFIG.stock, sku, CONFIG.brand, CONFIG.weight, CONFIG.length, CONFIG.width, CONFIG.height, ...imgCells, nImg, matchNote]);
    T.push([p.code, tiktokTitle(x), clip(tiktokDesc(x), LIMIT.tiktok.desc), tiktokHashtags(x), price, CONFIG.stock, sku, CONFIG.weight, CONFIG.length, CONFIG.width, CONFIG.height, ...imgCells, nImg, [tkNote, matchNote].filter(Boolean).join(' · ')]);

    const seo = webSeo(x);
    W.push([p.code, matched?.name || '—', seo.title, seo.meta, seo.h1, matched ? 'มีบนเว็บแล้ว' : 'ยังไม่มีบนเว็บ', best.toFixed(2)]);

    console.log(`  ${p.code}  ${matched ? '✓' : '✗'} ${best.toFixed(2)}  ${nImg} รูป  ${x.genre.name}  ${p.title.slice(0, 45)}`);
  }

  console.log(`\nทั้งหมด ${catalog.length} รายการ${warn ? ` · มีหมายเหตุให้เช็ค ${warn} รายการ (ดูคอลัมน์ "หมายเหตุ")` : ''}`);

  // ── ตัวอย่าง dry-run ──
  if (!APPLY) {
    console.log('\n──────── ตัวอย่างรายการแรก ────────');
    console.log(`Shopee  (${S[1][1].length}/${LIMIT.shopee.title}): ${S[1][1]}`);
    console.log(`Lazada  (${L[1][1].length}/${LIMIT.lazada.title}): ${L[1][1]}`);
    console.log(`TikTok  (${T[1][1].length}/${LIMIT.tiktok.title}): ${T[1][1]}`);
    console.log(`Web     (${W[1][2].length}/${LIMIT.web.title}): ${W[1][2]}`);
    console.log(`Meta    (${W[1][3].length}/${LIMIT.web.meta}): ${W[1][3]}`);
    console.log('\n(dry run — ใส่ --apply เพื่อเขียนไฟล์)');
    return;
  }

  // ── เขียน xlsx ──
  const wb = XLSX.utils.book_new();
  const addSheet = (name, rows, widths) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = widths.map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  addSheet('Shopee', S, [6, 14, 60, 80, 8, 6, 10, 10, 5, 5, 5, 40, ...Array(9).fill(45), 8, 30]);
  addSheet('Lazada', L, [6, 60, 50, 80, 30, 8, 6, 10, 12, 10, 5, 5, 5, ...Array(9).fill(45), 8, 30]);
  addSheet('TikTok Shop', T, [6, 60, 80, 40, 8, 6, 10, 10, 5, 5, 5, ...Array(9).fill(45), 8, 30]);
  addSheet('Website', W, [6, 50, 55, 70, 60, 14, 8]);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  XLSX.writeFile(wb, OUT_FILE, { bookType: 'xlsx' });
  console.log(`\n✔ templates/marketplace-listings.xlsx  (4 ชีต: Shopee / Lazada / TikTok Shop / Website)`);
  console.log('  เปิดไฟล์แล้ว copy คอลัมน์ลงเทมเพลต mass upload ของแต่ละแพลตฟอร์มได้เลย');
  console.log('  (Shopee มีไฟล์เทมเพลตจริงอยู่แล้ว → ใช้ npm run mkt:shopee เติมให้อัตโนมัติแทนได้)');
})();
