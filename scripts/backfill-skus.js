/**
 * เปลี่ยน SKU ของสินค้าทั้งหมดเป็นรูปแบบใหม่  BT-<หมวด>-<ความจุ>-<เลขชุด NAS>
 *
 *   node scripts/backfill-skus.js            # dry-run — ดูตารางก่อน ไม่แตะ DB
 *   node scripts/backfill-skus.js --apply    # เขียน sku ลง DB จริง
 *   node scripts/backfill-skus.js --no-images  # ข้ามการจับคู่ด้วยรูป (เร็ว แต่ได้เฉพาะที่เทียบชื่อได้)
 *
 * เลขชุด = เลขโฟลเดอร์ NAS (Z:\music = Z:\photos\Product = ไฟล์ปกที่ปริ้น เลขชุดเดียวกัน)
 * จับคู่สินค้า↔โฟลเดอร์ด้วย dHash ของรูป (แม่นสุด) + ความเหมือนของชื่อเป็นตัวช่วยยืนยัน
 * ผลลัพธ์เขียนเป็น reports/sku-backfill.csv ไว้ตรวจก่อนสั่ง --apply
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { buildSku, capacityFromSpecs, capacityFromFolderName, seriesFromFolderName, parseSku } = require('./lib/sku');
const { imageSlugFromUrl } = require('./lib/product-image-path');
const { byNaturalName } = require('./lib/web-images');
const { nasDir } = require('./lib/nas');

const ROOT = path.join(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const USE_IMAGES = !process.argv.includes('--no-images');
const ACCEPT_NAME = process.argv.includes('--accept-name');   // ยอมรับที่จับคู่ได้จากชื่ออย่างเดียว
const FIX_CAP = process.argv.includes('--fix-capacity');      // อัป specs.ความจุ ตาม Z:\music (ต้นฉบับจริง)

/** ระบุเลขชุดเองสำหรับตัวที่รูปจับไม่ได้ — `--set SKU-052=29 --set usb-mp3-x=7` (ใส่ sku เดิมหรือ slug ก็ได้) */
const MANUAL = new Map();
process.argv.forEach((a, i) => {
  const v = a.startsWith('--set=') ? a.slice(6) : (a === '--set' ? process.argv[i + 1] : '');
  const m = String(v || '').match(/^(.+)=(\d{1,3})$/);
  if (m) MANUAL.set(m[1].trim(), parseInt(m[2], 10));
});
const MUSIC_DIR = process.env.MUSIC_DIR || 'Z:\\music';
const PRINT_DIR = process.env.PRINT_DIR || 'Z:\\photos\\epson-print\\ภาพ_named';
const REPORT_DIR = path.join(ROOT, 'reports');
const CACHE_FILE = path.join(REPORT_DIR, '.sku-hash-cache.json');
const IMG_RE = /\.(jpe?g|png|webp|avif)$/i;
const HASH_MAX = 10;        // hamming distance ที่ยังถือว่าเป็นรูปเดียวกัน (dHash 64 บิต)
const NAS_MAX = 14;         // เทียบรูปในโฟลเดอร์ NAS กี่ใบ — ลำดับรูป NAS ≠ ลำดับบนเว็บ ต้องกวาดทั้งชุด
const WEB_MAX = 9;          // รูปเว็บต่อสินค้า

// .env.local ต้องมาก่อน — DATABASE_URL ที่ใช้รันในเครื่องอยู่ไฟล์นั้น ไม่ใช่ .env
for (const f of ['.env.local', '.env']) {
  const p = path.join(ROOT, 'server', f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
const { PrismaClient } = require(path.join(ROOT, 'server', 'node_modules', '@prisma', 'client'));

const ls = dir => { try { return fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; } };

/** คลังเลขชุดจาก NAS — เลขเดียวกันทั้งโฟลเดอร์เพลง / โฟลเดอร์รูป / ไฟล์ปกที่ปริ้น */
function loadNasSeries() {
  const series = new Map();   // no → { no, music, print, capacity, photoDir }
  const put = (no, patch) => {
    if (!no) return;
    series.set(no, { no, music: '', print: '', capacity: '', photoDir: '', ...(series.get(no) || {}), ...patch });
  };
  for (const e of ls(MUSIC_DIR)) {
    if (!e.isDirectory()) continue;
    const no = seriesFromFolderName(e.name);
    put(no, { music: e.name, capacity: capacityFromFolderName(e.name) });
  }
  for (const e of ls(PRINT_DIR)) {
    if (e.isDirectory()) continue;
    const no = seriesFromFolderName(e.name);
    const cur = series.get(no);
    put(no, { print: e.name, capacity: (cur && cur.capacity) || capacityFromFolderName(e.name) });
  }
  for (const e of ls(nasDir())) {
    if (!e.isDirectory()) continue;
    const no = seriesFromFolderName(e.name);
    if (no) put(no, { photoDir: path.join(nasDir(), e.name) });
  }
  return series;
}

// ── dHash + cache ────────────────────────────────────────────────────────────
const cache = (() => { try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { return {}; } })();
let cacheDirty = false;

async function dhash(file) {
  let st; try { st = fs.statSync(file); } catch { return null; }
  const key = `${file}|${st.size}|${Math.round(st.mtimeMs)}`;
  if (cache[key]) return cache[key];
  try {
    const { data } = await sharp(file, { failOn: 'none' })
      .resize(9, 8, { fit: 'fill' }).grayscale().raw().toBuffer({ resolveWithObject: true });
    let bits = '';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += data[y * 9 + x] < data[y * 9 + x + 1] ? '1' : '0';
    cache[key] = bits; cacheDirty = true;
    return bits;
  } catch { return null; }
}

const hamming = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; };

async function hashFirst(files, max) {
  const out = [];
  for (const f of files.slice(0, max)) { const h = await dhash(f); if (h) out.push(h); }
  return out;
}

const imagesIn = dir => ls(dir).filter(e => e.isFile() && IMG_RE.test(e.name))
  .map(e => e.name).sort(byNaturalName).map(n => path.join(dir, n));

// ── ความเหมือนของชื่อ (ตัวช่วยยืนยัน) ────────────────────────────────────────
const normTh = s => String(s || '').toLowerCase()
  .replace(/usb|แฟลชไดร์ฟ|แฟลชไดรฟ์|mp3|รวมเพลง|เพลง|ไดร์ฟ|[\d]+gb|[-–—.,!?"'’“”()[\]]/g, ' ')
  .replace(/\s+/g, ' ').trim();

function nameScore(productName, nasName) {
  const a = normTh(productName), b = normTh(nasName.replace(/^\d+[.\s-]*/, ''));
  if (!a || !b) return 0;
  const toks = b.split(' ').filter(t => t.length >= 2);
  if (!toks.length) return 0;
  return toks.filter(t => a.includes(t)).length / toks.length;
}

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  const prisma = new PrismaClient();
  const series = loadNasSeries();
  if (!series.size) throw new Error(`อ่าน NAS ไม่ได้ (${MUSIC_DIR}) — ต่อไดรฟ์ Z: ก่อน`);
  console.log(`📀 เลขชุดบน NAS: ${series.size} ชุด · โฟลเดอร์รูปที่หาได้ ${[...series.values()].filter(s => s.photoDir).length}`);

  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'asc' },
    include: { category: { select: { name: true } } },
  });
  console.log(`🛒 สินค้าใน DB: ${products.length} ตัว\n`);

  // hash รูปฝั่ง NAS ล่วงหน้า (แพงสุด ทำครั้งเดียวแล้ว cache)
  const nasHashes = new Map();
  if (USE_IMAGES) {
    let n = 0;
    for (const s of series.values()) {
      if (!s.photoDir) continue;
      nasHashes.set(s.no, await hashFirst(imagesIn(s.photoDir), NAS_MAX));
      process.stdout.write(`\r   hash รูป NAS… ${++n}`);
    }
    console.log('');
  }

  const rows = [];
  for (const p of products) {
    const imgSlug = imageSlugFromUrl(p.imageUrl) || imageSlugFromUrl((p.images || [])[0]);
    const webDir = imgSlug ? path.join(ROOT, 'images', 'products', imgSlug) : '';

    // 1) จับคู่ด้วยรูป
    let best = null, second = null;
    if (USE_IMAGES && webDir && fs.existsSync(webDir)) {
      const webH = await hashFirst(imagesIn(webDir).filter(f => /\.webp$/i.test(f)), WEB_MAX);
      for (const [no, hs] of nasHashes) {
        let hits = 0, min = 64;
        for (const a of webH) for (const b of hs) { const d = hamming(a, b); if (d < min) min = d; if (d <= HASH_MAX) { hits++; break; } }
        const cand = { no, hits, min };
        if (!best || hits > best.hits || (hits === best.hits && min < best.min)) { second = best; best = cand; }
        else if (!second || hits > second.hits || (hits === second.hits && min < second.min)) second = cand;
      }
    }

    // 2) เทียบชื่อ
    let nameBest = null;
    for (const s of series.values()) {
      // ชื่อโฟลเดอร์รูปมักเป็นชื่อสินค้าเต็ม ๆ — ตัวช่วยที่ดีกว่าชื่อสั้นในโฟลเดอร์เพลง
      const sc = Math.max(nameScore(p.name, s.music), nameScore(p.name, s.print),
        nameScore(p.name, path.basename(s.photoDir || '')));
      if (sc > 0 && (!nameBest || sc > nameBest.score)) nameBest = { no: s.no, score: sc };
    }

    // เชื่อรูปเท่านั้น — ต้องแมตช์ ≥2 ใบ และชนะอันดับ 2 ชัด (1 ใบใช้ได้เฉพาะตอนเหมือนมาก d≤6 และไม่มีคู่แข่ง)
    const runnerHits = second ? second.hits : 0;
    const imgOk = !!best && (
      (best.hits >= 2 && best.hits > runnerHits) ||
      (best.hits === 1 && best.min <= 6 && runnerHits === 0)
    );
    // ชื่อซ้ำกันเยอะ (ลูกกรุง/เพื่อชีวิต มีหลายชุด) เลยเป็นได้แค่ "ข้อเสนอ" ต้องสั่ง --accept-name ถึงจะใช้
    const nameOk = !imgOk && nameBest && nameBest.score >= 0.6;
    const manual = MANUAL.get(p.sku || '') ?? MANUAL.get(p.slug || '') ?? null;
    const no = manual || (imgOk ? best.no : (nameOk && ACCEPT_NAME ? nameBest.no : null));
    const how = manual ? 'สั่งเอง' : (imgOk ? 'รูป' : (nameOk ? (ACCEPT_NAME ? 'ชื่อ' : 'ชื่อ?') : '-'));
    const agree = no && nameBest && nameBest.no === no ? 'ตรงกัน' : (no && nameBest ? `ชื่อชี้ ${nameBest.no}` : '');

    const s = no ? series.get(no) : null;
    const capDb = capacityFromSpecs(p.specs);
    const capNas = s ? s.capacity : '';
    const capacity = capNas || capDb;
    const sku = no ? buildSku({ categoryName: p.category?.name, capacity, no }) : '';

    // ความจุที่เขียนไว้ในชื่อ/รายละเอียด/slug — ถ้าไม่ตรงค่าใหม่ต้องให้คนแก้เอง (แตะ = กระทบ SEO)
    const inText = [...new Set((`${p.name} ${p.description || ''} ${p.slug}`.match(/\d+\s?(?:GB|MB)/gi) || [])
      .map(s => s.toUpperCase().replace(/\s/g, '')))];
    const textWarn = capNas && inText.length && !inText.includes(capNas.toUpperCase()) ? inText.join('/') : '';

    rows.push({
      id: p.id, name: p.name, slug: p.slug, oldSku: p.sku || '', newSku: sku, specs: p.specs, textWarn,
      no: no || '', how, agree, category: p.category?.name || '', capDb, capNas,
      capWarn: capDb && capNas && capDb !== capNas ? 'ความจุ DB ≠ NAS' : '',
      nas: s ? (s.music || s.print) : '', imgSlug,
      suggest: !no && nameBest ? `${nameBest.no} (ชื่อ ${Math.round(nameBest.score * 100)}%)` : '',
      conf: imgOk ? `รูปตรง ${best.hits} ใบ · d${best.min}` : (nameBest ? `ชื่อ ${Math.round(nameBest.score * 100)}%` : ''),
    });
  }

  if (cacheDirty) { fs.mkdirSync(REPORT_DIR, { recursive: true }); fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)); }

  // ชนกัน = จับคู่ผิดแน่นอน ต้องแก้ก่อน apply
  const used = {};
  rows.filter(r => r.newSku).forEach(r => (used[r.newSku] = (used[r.newSku] || []).concat(r.name.slice(0, 30))));
  const dup = Object.entries(used).filter(([, v]) => v.length > 1);

  const pad = (s, n) => String(s || '').padEnd(n).slice(0, n);
  console.log(pad('SKU ใหม่', 17) + pad('SKU เดิม', 12) + pad('ชุด', 5) + pad('วิธี', 6) + pad('ความมั่นใจ', 18) + 'สินค้า / โฟลเดอร์ NAS');
  console.log('-'.repeat(120));
  for (const r of rows) {
    console.log(pad(r.newSku || '⚠ ไม่รู้ชุด', 17) + pad(r.oldSku, 12) + pad(r.no, 5) + pad(r.how, 7) + pad(r.conf, 20)
      + pad(r.name, 34) + ' | ' + pad(r.nas, 28) + (r.capWarn ? ' ⚠ ' + r.capWarn + ` (${r.capDb}→${r.capNas})` : '')
      + (r.agree && r.agree !== 'ตรงกัน' ? ' ⚠ ' + r.agree : '') + (r.suggest ? ' → น่าจะชุด ' + r.suggest : ''));
  }

  const matched = rows.filter(r => r.newSku);
  console.log(`\nจับคู่ได้ ${matched.length}/${rows.length} · ด้วยรูป ${rows.filter(r => r.how === 'รูป').length} · ด้วยชื่อ ${rows.filter(r => r.how === 'ชื่อ').length}`);
  if (dup.length) console.log('❌ SKU ชนกัน (จับคู่ผิด ต้องแก้ก่อน): ' + dup.map(([k, v]) => `${k} = ${v.join(' / ')}`).join(' · '));
  const capWarn = rows.filter(r => r.capWarn);
  if (capWarn.length) console.log(`⚠ ความจุใน DB ไม่ตรง NAS ${capWarn.length} ตัว — SKU ใช้ค่าจาก NAS` + (FIX_CAP ? ' และจะอัป specs ตามด้วย' : ' แต่ specs ใน DB ยังเป็นของเดิม (สั่ง --fix-capacity ให้อัปด้วย)'));
  const textWarn = rows.filter(r => r.textWarn && r.capWarn);
  if (textWarn.length) {
    console.log(`\n⚠ ${textWarn.length} ตัวเขียนความจุไว้ในชื่อ/รายละเอียด/slug ไม่ตรงค่าใหม่ — ต้องแก้ข้อความเอง (แตะอัตโนมัติ = กระทบ SEO):`);
    textWarn.forEach(r => console.log(`   ${r.newSku}  ข้อความว่า ${r.textWarn} · NAS ว่า ${r.capNas}  | ${r.name.slice(0, 44)}`));
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const head = ['id', 'name', 'slug', 'oldSku', 'newSku', 'no', 'how', 'conf', 'agree', 'suggest', 'category', 'capDb', 'capNas', 'capWarn', 'nas', 'imgSlug'];
  const csv = [head.join(',')].concat(rows.map(r => head.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))).join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'sku-backfill.csv'), '\uFEFF' + csv, 'utf8');
  console.log(`📄 รายงาน: reports/sku-backfill.csv`);

  if (!APPLY) { console.log('\n(dry-run — ยังไม่เขียน DB · สั่ง --apply เมื่อตรวจตารางแล้ว)'); await prisma.$disconnect(); return; }
  if (dup.length) { console.log('\n❌ ไม่เขียน DB เพราะ SKU ชนกัน'); await prisma.$disconnect(); process.exit(1); }

  let n = 0, c = 0;
  for (const r of matched) {
    const data = {};
    if (r.oldSku !== r.newSku) { data.sku = r.newSku; n++; }
    if (FIX_CAP && r.capWarn) {
      data.specs = { ...(r.specs && typeof r.specs === 'object' ? r.specs : {}), 'ความจุ': r.capNas };
      c++;
    }
    if (Object.keys(data).length) await prisma.product.update({ where: { id: r.id }, data });
  }
  console.log(`\n✔ อัปเดต SKU ${n} ตัว` + (FIX_CAP ? ` · แก้ความจุใน specs ${c} ตัว` : '') + ` — ต่อด้วย: node scripts/sync-products-json.js && npm run build`);
  await prisma.$disconnect();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
