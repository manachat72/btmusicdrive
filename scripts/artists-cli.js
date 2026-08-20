#!/usr/bin/env node
/**
 * artists-cli — จัดการ cache วัตถุดิบ SEO รายศิลปิน (scripts/data/artists.json)
 *
 *   node scripts/artists-cli.js todo [--limit 30] [--min 2]
 *       สแกน tracklist ใน products.json หาศิลปินที่ยังไม่เคยวิจัย
 *       เรียงตามจำนวนสินค้าที่ศิลปินคนนั้นโผล่ (คุ้มที่สุดก่อน)
 *
 *   node scripts/artists-cli.js prompt [--limit 20]
 *       พิมพ์รายชื่อพร้อมคำสั่งสำหรับวางให้ agent seo-artist-research
 *
 *   node scripts/artists-cli.js save <file.json>
 *       merge ผล JSON จาก agent (object เดี่ยว หรือ array) ลง cache พร้อม validate
 *
 *   node scripts/artists-cli.js stats
 */
const fs = require('fs');
const path = require('path');
const { extractArtists } = require('./lib/seo');
const A = require('./lib/artists');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(3);
const cmd = process.argv[2] || 'todo';
const flag = (n, d) => {
  const i = args.indexOf('--' + n);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

function loadProducts() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));
  } catch (e) {
    console.error('อ่าน products.json ไม่ได้:', e.message);
    process.exit(1);
  }
}

/** นับว่าศิลปินแต่ละคนโผล่ในสินค้ากี่ตัว */
function tally() {
  const count = new Map();
  for (const p of loadProducts()) {
    const list = Array.isArray(p.tracklist) ? p.tracklist : [];
    if (!list.length) continue;
    for (const a of extractArtists(list, 10)) {
      count.set(a, (count.get(a) || 0) + 1);
    }
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]);
}

function todo() {
  const limit = Number(flag('limit', 30));
  const min = Number(flag('min', 1));
  const rows = tally().filter(([n, c]) => c >= min && !A.isResearched(n));
  if (!rows.length) return console.log('วิจัยครบทุกชื่อแล้ว ✓');
  console.log(`ยังไม่ได้วิจัย ${rows.length} ชื่อ (แสดง ${Math.min(limit, rows.length)}):\n`);
  for (const [name, c] of rows.slice(0, limit)) {
    console.log(`  ${String(c).padStart(3)} สินค้า  ${name}`);
  }
  console.log(`\nสั่งวิจัย: node scripts/artists-cli.js prompt --limit ${limit}`);
}

function prompt() {
  const limit = Number(flag('limit', 20));
  const names = tally().filter(([n]) => !A.isResearched(n)).slice(0, limit).map(([n]) => n);
  if (!names.length) return console.log('วิจัยครบทุกชื่อแล้ว ✓');
  console.log('--- วางข้อความนี้ให้ Claude (agent: seo-artist-research) ---\n');
  console.log('วิจัยศิลปินต่อไปนี้แล้วบันทึกลง scripts/data/artists.json:\n');
  names.forEach(n => console.log('- ' + n));
}

function save(file) {
  if (!file) { console.error('ระบุไฟล์ JSON ด้วย'); process.exit(1); }
  let data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data)) data = [data];
  let ok = 0, skip = 0;
  for (const e of data) {
    try {
      A.saveArtist(e.artist, e);
      console.log(`${e.unknown ? '· unknown' : '✓ saved  '} ${e.artist}`);
      ok++;
    } catch (err) {
      console.error(`✗ ${e && e.artist} — ${err.message}`);
      skip++;
    }
  }
  console.log(`\nบันทึก ${ok} · ข้าม ${skip} → ${path.relative(ROOT, A.FILE)}`);
}

function stats() {
  const all = A.loadArtists({ fresh: true });
  const keys = Object.keys(all);
  const unk = keys.filter(k => all[k].unknown === true).length;
  const pending = tally().filter(([n]) => !A.isResearched(n)).length;
  console.log(`cache: ${keys.length} ชื่อ (รู้จัก ${keys.length - unk} · unknown ${unk})`);
  console.log(`ยังไม่ได้วิจัย: ${pending} ชื่อ`);
}

/** ตรวจว่าต่อ cache เข้า buildSeo แล้วของเดิมไม่พัง */
function selftest() {
  const { buildSeo, validateSeo } = require('./lib/seo');
  const ok = (label, cond, extra = '') =>
    console.log(`${cond ? '✓' : '✗ FAIL'}  ${label}${extra ? '  → ' + extra : ''}`);

  // 1) ไม่มี tracklist = ต้องได้ผลเหมือน rule-based เดิมทุกอย่าง
  const plain = buildSeo({ shortName: 'ฮิตยุค 90', tracklist: [] });
  ok('ไม่มี tracklist → tags ≤ 12', plain.tags.length <= 12, plain.tags.length + ' tags');
  ok('ไม่มี tracklist → ไม่มี artistsMissing', plain.artistsMissing.length === 0);
  ok('meta description ≤ 155', plain.metaDescription.length <= 155, plain.metaDescription.length + ' ตัว');
  ok('มี slug', !!plain.slug, plain.slug);

  // 2) ศิลปินที่อยู่ใน cache → ต้องได้คีย์เวิร์ดเพิ่ม + ไม่นับเป็น missing
  const A_NAME = 'พุ่มพวง ดวงจันทร์';
  const tl = Array.from({ length: 3 }, (_, i) => `0${i + 1}. เพลงที่ ${i + 1} - ${A_NAME}`);
  const hit = buildSeo({ shortName: 'ลูกทุ่งอมตะ', tracklist: tl });
  const cached = A.getArtist(A_NAME);
  if (cached) {
    ok('ศิลปินใน cache ไม่ถูกนับเป็น missing', !hit.artistsMissing.includes(A_NAME), JSON.stringify(hit.artistsMissing));
    ok('tags ได้ long-tail จาก cache', hit.tags.some(t => cached.keywords.includes(t)), hit.tags.join(' | '));
    ok('BASE_KW ยังอยู่ครบ', ['แฟลชไดรฟ์เพลง', 'USB เพลง', 'เพลงในรถ', 'MP3 ฟังในรถ'].every(k => hit.tags.includes(k)));
    ok('hook ศิลปินอยู่หลัง 155 ตัวแรก', hit.description.indexOf(cached.hook) > 155);
    ok('meta ไม่โดน hook ศิลปินแทรก', !hit.metaDescription.includes(cached.hook));
  } else {
    console.log('· ข้ามชุด 2 — ไม่มี ' + A_NAME + ' ใน cache');
  }

  // 3) ศิลปินที่ยังไม่วิจัย → ต้องขึ้น missing + warn
  const un = buildSeo({ shortName: 'เพลงรวม', tracklist: ['01. ก - ศิลปินไม่มีจริงนะจ๊ะ', '02. ข - ศิลปินไม่มีจริงนะจ๊ะ'] });
  ok('ศิลปินใหม่ขึ้น missing', un.artistsMissing.length > 0, un.artistsMissing.join(', '));
  ok('validateSeo เตือนให้ไปวิจัย', validateSeo(un).some(i => /(seo-artist-research|ai-artist|วิจัยศิลปิน)/.test(i.msg)));

  // 4) validateEntry
  ok('validateEntry จับ entry พัง', A.validateEntry({ artist: 'x', unknown: false }).length > 0);
  ok('validateEntry ผ่าน unknown', A.validateEntry({
    artist: 'x', unknown: true, type: '', genre: '', aliases: [], keywords: [], hook: '', notes: '',
  }).length === 0);
}

({ todo, prompt, save, stats, selftest }[cmd] || todo)(args[0]);
