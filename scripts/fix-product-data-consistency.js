// แก้ข้อมูลที่ขัดกันเองระหว่าง description / specs / tracklist / โฟลเดอร์จริงบน NAS
// dry-run:  node scripts/fix-product-data-consistency.js
// เขียนจริง: node scripts/fix-product-data-consistency.js --apply
//
// ที่มาของตัวเลข (2026-08-28):
//   จำนวนเพลง = tracklist ใน DB (ตรงกับ specs.จำนวนเพลง อยู่แล้ว 51/53 ตัว)
//   ความจุ    = ชื่อโฟลเดอร์ต้นฉบับบน NAS Z:\เพลงแฟลชไดร์ (จับคู่ด้วยรายชื่อเพลงตรงกัน ≥93%)
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

// desc: [[ข้อความเดิม, ข้อความใหม่, จำนวนจุดที่ต้องเจอ]] · specs: { key: value }
const FIXES = {
  // ── จำนวนเพลงในคำอธิบายไม่ตรงกับรายชื่อเพลงจริง ──
  'usb-flash-drive-mp3-90s-greatest-hits': {
    desc: [['รวม 300 เพลง', 'รวม 227 เพลง', 1]],
    specs: { 'ความจุ': '4GB' },                       // NAS: 043. ฮิต90 - [4GB]
  },
  'usb-flash-drive-mp3-includes-songs-from-the-90s': {
    desc: [['รวม 192 เพลง', 'รวม 186 เพลง', 1]],
  },
  'usb-mp3-southern-memories-original': {
    desc: [['รวม 195 เพลง', 'รวม 192 เพลง', 1], ['1GB', '4GB', 1]],
    specs: { 'ความจุ': '4GB' },                       // NAS: 023. เสียงใต้ในความทรงจำ [4GB]
  },
  'usb-mp3-tai-dontri': {
    desc: [['รวม <strong>100 เพลงใต้ฮิต</strong>', 'รวม <strong>108 เพลงใต้ฮิต</strong>', 1]],
  },
  'usb-mp3-hits-2000': {
    desc: [['รวมกว่า 100+ เพลง', 'รวม 108 เพลง', 1], ['4GB', '1GB', 2]],
  },
  'usb-mp3-luk-krung-amata': {
    desc: [['รวมกว่า 210+ เพลง', 'รวม 215 เพลง', 1], ['4GB', '1GB', 1]],
  },
  'usb-mp3-kru-sla': {
    desc: [['รวมกว่า 160+ เพลง', 'รวม 168 เพลง', 1], ['4GB', '1GB', 2]],
  },
  'usb-mp3-sek-loso': {
    desc: [['รวมกว่า 120+ เพลง', 'รวม 172 เพลง', 1], ['4GB', '2GB', 2]],
  },
  'usb-mp3-90s-classic': {
    desc: [['รวมกว่า 180+ เพลง', 'รวม 198 เพลง', 1], ['4GB', '1GB', 1]],
  },
  'usb-mp3-thai-rock-2000': {
    desc: [['รวมกว่า 170+ เพลง', 'รวม 174 เพลง', 1], ['1GB', '2GB', 1]],
  },
  'usb-mp3-string-90s': {
    desc: [['รวมกว่า 200+ เพลง', 'รวม 278 เพลง', 1], ['8GB', '4GB', 1]],
  },
  'usb-mp3-tiktok-hits': {
    desc: [['กว่า 216+ เพลง', 'รวม 197 เพลง', 1], ['4GB', '2GB', 2]],
  },
  'usb-mp3-rock-legend': {
    desc: [['รวมกว่า 170 เพลง', 'รวม 175 เพลง', 1]],
  },
  'usb-mp3-ruam-phleng-phngsethph-kraodnch-anay-2gb': {
    specs: { 'จำนวนเพลง': '161 เพลง' },               // tracklist จริง 161 (เดิมค้าง 177)
  },

  // ── ความจุไม่ตรงกับโฟลเดอร์ต้นฉบับบน NAS ──
  'usb-mp3-3cha-peuachiwit-cover': {
    specs: { 'ความจุ': '2GB' },                       // NAS: 045. 3ช่าเพื่อชีวิต [2GB]
  },
  'usb-flash-drive-mp3-includes-80s-era-string-music': {
    specs: { 'ความจุ': '1GB' },                       // NAS: 042. สตริง80 [1GB]
  },
  'usb-mp3-luk-krung-suntharaporn': {
    desc: [['2GB', '1GB', 1]],
    specs: { 'ความจุ': '1GB' },                       // NAS: 013. สุนทราภรณ์ [1GB]
  },
  'usb-flash-drive-mp3-includes-labanun-songs': {
    specs: { 'ความจุ': '1GB' },                       // NAS: 010. ลาบานูน [1GB]
  },
  'usb-mp3-rock-memories': {
    desc: [['4GB', '2GB', 1]],
    specs: { 'ความจุ': '2GB' },                       // NAS: 015. ร็อคในความทรงจำ [2GB]
  },
  'usb-mp3-got-jakrapat': {
    desc: [['1GB', '4GB', 1]],
    specs: { 'ความจุ': '4GB' },                       // NAS: 025. ก็อต จักรพรรณ์ [4GB]
  },
  'usb-mp3-luk-krung-4gb': {
    specs: { 'ความจุ': '4GB' },                       // NAS: 024. ลูกกรุงอมตะ [4GB]
  },
  'usb-mp3-dance-vol2': { desc: [['4GB', '2GB', 1]] },        // NAS: 011. [2GB]
  'usb-mp3-tai-hit': { desc: [['4GB', '2GB', 1]] },           // NAS: 021. [2GB]
  'usb-mp3-luk-thung-indy-4gb': { desc: [['4GB', '2GB', 2]] },// NAS: 035. [2GB]
  'usb-mp3-rock-90s': { desc: [['4GB', '1GB', 1]] },          // NAS: 027. [1GB]
  'usb-mp3-pong-pat': { desc: [['4GB', '1GB', 1]] },          // NAS: 016. [1GB]
};

const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();

const ctx = (s, at, len) => `…${s.slice(Math.max(0, at - 55), at + len + 25).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')}…`;

async function main() {
  console.log(APPLY ? '=== APPLY (เขียนลง DB จริง) ===\n' : '=== DRY RUN (ยังไม่เขียน) ===\n');
  let planned = 0;
  let failed = 0;

  for (const [slug, fix] of Object.entries(FIXES)) {
    const p = await prisma.product.findUnique({
      where: { slug },
      select: { id: true, description: true, specs: true, tracklist: true },
    });
    if (!p) { console.log(`✗ ${slug} — ไม่พบใน DB\n`); failed++; continue; }

    console.log('─'.repeat(72));
    console.log(`${slug}  (รายชื่อเพลงจริง ${(p.tracklist || []).length} รายการ)`);

    const data = {};
    let ok = true;

    if (fix.desc) {
      let desc = p.description || '';
      for (const [from, to, want] of fix.desc) {
        const hits = desc.split(from).length - 1;
        if (hits !== want) {
          console.log(`  ✗ พบ "${from}" ${hits} จุด (คาดไว้ ${want}) — ข้ามสินค้าตัวนี้`);
          ok = false;
          break;
        }
        let at = desc.indexOf(from);
        while (at !== -1) {
          console.log(`  ก่อน: ${ctx(desc, at, from.length)}`);
          at = desc.indexOf(from, at + from.length);
        }
        desc = desc.split(from).join(to);
        console.log(`  →     "${from}" → "${to}"  (${hits} จุด)`);
      }
      if (!ok) { failed++; continue; }
      data.description = desc;
    }

    if (fix.specs) {
      const specs = { ...(p.specs || {}) };
      for (const [k, v] of Object.entries(fix.specs)) {
        console.log(`  specs.${k}: "${specs[k]}" → "${v}"`);
        specs[k] = v;
      }
      data.specs = specs;
    }

    planned++;
    if (APPLY) {
      await prisma.product.update({ where: { id: p.id }, data });
      console.log('  ✔ เขียนลง DB แล้ว');
    }
  }

  console.log('─'.repeat(72));
  console.log(`สรุป: ${planned} รายการ${APPLY ? 'เขียนแล้ว' : 'พร้อมเขียน'}${failed ? ` · ข้าม ${failed}` : ''}`);
  if (!APPLY) console.log('รันซ้ำด้วย --apply เพื่อเขียนจริง');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
