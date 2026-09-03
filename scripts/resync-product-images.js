#!/usr/bin/env node
/**
 * ดึงรูปจากโฟลเดอร์ NAS ของสินค้าเดิม มาทำรูปใหม่ครบทั้ง 3 ชั้น
 *
 * ใช้ตอนไหน: เพิ่ม/เปลี่ยนรูปในโฟลเดอร์ NAS แล้วอยากให้เว็บ + ลิงก์ marketplace ตามไปด้วย
 * สตูดิโอมีแค่ปุ่ม "ซิงก์รูปในโฟลเดอร์เข้าเว็บ" ซึ่งอ่านจาก images/products/<slug>/ ไม่ใช่ NAS
 * → รูปที่วางไว้บน NAS เฉย ๆ จะไม่ขึ้นเว็บเลยจนกว่าจะรันตัวนี้
 *
 * ทำอะไรบ้าง (ลำดับสำคัญ — DB ต้องชี้มาทีหลังไฟล์ขึ้น ไม่งั้นรูป 404):
 *   1. อ่านรูปจาก NAS เรียงแบบ Explorer (เพดาน 9 ใบ ตามที่ Shopee/TikTok รับ)
 *   2. ทำครบ 3 ชั้น: ต้นฉบับ R2 originals/ · รูปกลาง 1200 R2 products/<code>/ · รูปเว็บ webp+avif
 *   3. npm run build → git commit + push รูป
 *   4. PATCH images/imageUrl ใน DB → sync products.json → build → push
 *
 * Usage:
 *   node scripts/resync-product-images.js --code 26                 # dry-run: ดูว่าจะได้ใบไหนบ้าง
 *   node scripts/resync-product-images.js --code 26 --apply         # ทำจริง
 *   node scripts/resync-product-images.js --code 26 --apply --no-push   # ทำรูป+DB แต่ไม่ push
 *   เพิ่ม --slug <imgSlug> ถ้าเดาโฟลเดอร์รูปจาก products.json ไม่ได้
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const webImg = require('./lib/web-images');
const { processProductImages } = require('./lib/product-images');

const ROOT = path.resolve(__dirname, '..');
const NAS_DIR = require('./lib/nas').nasDir();

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const NO_PUSH = argv.includes('--no-push');
const argVal = (f, d) => { const i = argv.indexOf(f); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const CODE = String(argVal('--code', '')).padStart(2, '0');

if (!/^\d{2,}$/.test(CODE)) {
  console.error('✖ ต้องระบุ --code NN (เลขชุดรูป marketplace)');
  process.exit(1);
}

/** ADMIN_PASSWORD จาก server/.env — ไฟล์อยู่ในเครื่อง ไม่เข้า git และห้าม log ค่าออกมา */
function adminPw() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  for (const f of ['.env', '.env.local']) {
    try {
      const m = fs.readFileSync(path.join(ROOT, 'server', f), 'utf8').match(/^\s*ADMIN_PASSWORD\s*=\s*(.*)$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    } catch { }
  }
  return null;
}

function runCmd(cmd, args) {
  // ไม่ใช้ shell:true — ชื่อสินค้าไทยมีช่องว่าง จะแตกเป็นหลาย arg
  if (process.platform === 'win32' && /^npm$/.test(cmd)) {
    const cli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    if (fs.existsSync(cli)) return execFileSync(process.execPath, [cli, ...args], { cwd: ROOT, stdio: 'pipe' }).toString();
  }
  return execFileSync(cmd, args, { cwd: ROOT, stdio: 'pipe', shell: false }).toString();
}

function gitPush(message, extraPaths = []) {
  try {
    runCmd('git', ['add', '-u']);
    // marketplace-images/ templates/ qr/ อยู่ใน .gitignore — ห้ามใส่ จะทำให้ git add ล้ม
    for (const p of extraPaths) { try { runCmd('git', ['add', '--', p]); } catch { } }
    const staged = runCmd('git', ['diff', '--cached', '--name-only']).trim();
    if (!staged) return '(ไม่มีไฟล์เปลี่ยน)';
    runCmd('git', ['commit', '-m', message]);
    runCmd('git', ['push']);
    return `push แล้ว ${staged.split('\n').length} ไฟล์`;
  } catch (e) {
    return `⚠ ไม่ได้ push: ${String(e.stderr || e.message).slice(0, 200)}`;
  }
}

function findNasDir(code) {
  const dirs = fs.readdirSync(NAS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && new RegExp(`^0*${parseInt(code, 10)}\\s*-`).test(d.name))
    .map(d => d.name);
  if (!dirs.length) throw new Error(`ไม่พบโฟลเดอร์ที่ขึ้นต้นด้วย "${code}-" ใน ${NAS_DIR}`);
  if (dirs.length > 1) throw new Error(`เจอหลายโฟลเดอร์สำหรับ code ${code}:\n  ${dirs.join('\n  ')}`);
  return dirs[0];
}

(async () => {
  if (!fs.existsSync(NAS_DIR)) {
    console.error(`✖ เข้าถึง NAS ไม่ได้: ${NAS_DIR} — ต่อไดรฟ์ก่อน`);
    process.exit(1);
  }

  const dirName = findNasDir(CODE);
  const srcDir = path.join(NAS_DIR, dirName);
  const files = webImg.listSourceImages(srcDir);

  const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'marketplace-images', 'catalog.json'), 'utf8')).products;
  const catEntry = catalog.find(p => p.code === CODE);
  const slug = argVal('--slug', catEntry && catEntry.slug) ||
    (products.find(p => (p.imageUrl || '').includes(`/${(catEntry || {}).slug}/`)) || {}).imageUrl;
  const imgSlug = argVal('--slug', (catEntry && catEntry.slug) || '');
  if (!imgSlug) {
    console.error('✖ ไม่รู้โฟลเดอร์รูปของสินค้านี้ — ระบุ --slug <imgSlug> (ชื่อโฟลเดอร์ใน images/products/)');
    process.exit(1);
  }
  const product = products.find(p => (p.imageUrl || '').split('/')[3] === imgSlug);
  if (!product) {
    console.error(`✖ ไม่พบสินค้าที่ใช้โฟลเดอร์รูป ${imgSlug} ใน products.json`);
    process.exit(1);
  }

  console.log(`NAS      : ${dirName}`);
  console.log(`สินค้า    : ${product.name.slice(0, 60)}`);
  console.log(`โฟลเดอร์รูป: images/products/${imgSlug}/  (บนเว็บตอนนี้ ${(product.images || []).length} ใบ)`);
  console.log(`ไฟล์ใน NAS: ${files.length} ใบ — เรียงแบบ Explorer\n`);
  files.forEach((f, i) => console.log(`  ${i < 9 ? '✔ ' + String(i + 1).padStart(2) : '✖ ตัด'}  ${path.basename(f)}`));

  if (!APPLY) {
    console.log('\n(dry run — ใส่ --apply เพื่อทำจริง)');
    return;
  }

  console.log('\n=== APPLY ===\n');
  const img = await processProductImages({
    code: CODE, slug: imgSlug, title: product.name, srcDir, dirName,
    prune: true, log: m => console.log('  ' + m),
  });

  console.log('\n⏳ npm run build …');
  runCmd('npm', ['run', 'build']);
  if (!NO_PUSH) console.log('  ' + gitPush(`feat(images): resync รูปจาก NAS ${imgSlug} (${img.web.length} ใบ)`, ['images/products']));

  const pw = adminPw();
  if (!pw) {
    console.error('\n✖ ไม่พบ ADMIN_PASSWORD ใน server/.env — รูปทำเสร็จแล้วแต่ DB ยังไม่อัปเดต');
    process.exit(1);
  }
  const res = await fetch(`https://btmusicdrive.com/api/products/${product.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-admin-password': pw },
    body: JSON.stringify({ images: img.web, imageUrl: img.web[0] }),
  });
  if (!res.ok) throw new Error(`PATCH ล้มเหลว ${res.status}: ${(await res.text()).slice(0, 200)}`);
  console.log(`\n✔ อัปเดตรูปใน DB แล้ว (${img.web.length} ใบ)`);

  execFileSync(process.execPath, [path.join(__dirname, 'sync-products-json.js')], { cwd: ROOT, stdio: 'pipe' });
  console.log('✔ sync products.json');
  runCmd('npm', ['run', 'build']);
  if (!NO_PUSH) console.log('  ' + gitPush(`feat(images): products.json รูปใหม่ ${imgSlug}`));

  console.log(`\n✔ เสร็จ — https://btmusicdrive.com/product/${product.slug}`);
})().catch(e => { console.error('✖', e.message); process.exit(1); });
