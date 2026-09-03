#!/usr/bin/env node
/**
 * 🎛 Product Studio — หน้าเว็บหลังบ้าน (local) สำหรับลงสินค้าใหม่ + แก้ไขสินค้าเดิม
 *
 * ทำได้ 3 อย่าง:
 *   1. ลงสินค้าใหม่   ชื่อสั้น → รูป (NAS/อัปโหลด) → .txt รายชื่อเพลง → SEO อัตโนมัติ →
 *                     รีวิว/แก้ → ลงเว็บ btmusicdrive.com → xlsx ทุกแพลตฟอร์มพร้อมอัป
 *   2. แก้ไขสินค้าเดิม เลือกสินค้าบนเว็บ → แก้ชื่อ/ราคา/รายละเอียด/หมวด/tags → ทำ SEO ใหม่ →
 *                     เปลี่ยนชื่อไฟล์รูปให้ตรง slug ใหม่ → อัปเดตเว็บ
 *   3. QR             อัปไฟล์ (PDF/รูป/.txt รายชื่อเพลง) ขึ้น R2 + สร้าง QR พร้อมพิมพ์
 *
 * รูปแบ่ง 3 ชั้น (ต้นฉบับไม่ถูกลบ/แก้ และเก็บ 2 ที่ กัน NAS ไม่ได้ต่อ):
 *   ต้นฉบับ      R2 originals/<NN>-<slug>/  (ไฟล์ดิบ) + NAS Z:\photos\รูปสินค้า\<NN>-<ชื่อ>\ ถ้าต่ออยู่
 *   รูปกลาง      R2 products/<NN>/<NN>-01.jpg  1200×1200 ← ลิงก์ชุดนี้ที่ xlsx ทุกแพลตฟอร์มใช้
 *   เว็บ (เร็ว)   images/products/<slug>/<slug>-1.webp + .avif  ≤800px ← หน้าเว็บใช้ตัวนี้
 *
 * Usage: npm run mkt:studio   → เปิด http://localhost:4777
 *        เพิ่ม --local-api เพื่อยิง API ไป localhost:5000 แทน production
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const XLSX = require('xlsx');
const QRCode = require('qrcode');
const { tracklistHtml } = require('./lib/tracklist-page');
const { makeTracklistQr } = require('./lib/tracklist-qr');
const { buildSeo, validateSeo, CATEGORIES } = require('./lib/seo');
const { slugify, imageSlug, uniqueImageSlug } = require('./lib/product-slug');
const webImg = require('./lib/web-images');
const { processProductImages, fetchOriginals } = require('./lib/product-images');
const { PAGE, CLIENT_JS } = require('./lib/studio-page');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'templates');
const PORT = Number(process.env.PORT) || 4777;   // ชนพอร์ต? สั่ง PORT=4788 npm run mkt:studio
const NAS_DIR = require('./lib/nas').nasDir();
const API_BASE = process.argv.includes('--local-api') ? 'http://localhost:5000/api' : 'https://btmusicdrive.com/api';

let ADMIN_TOKEN = null;   // JWT หลัง login (อยู่ในหน่วยความจำระหว่างเปิด studio เท่านั้น)
// บัญชีที่สมัครผ่าน Google ไม่มี passwordHash เลย login ด้วยอีเมล+รหัสไม่ได้
// รองรับ ADMIN_PASSWORD (header x-admin-password) เป็นอีกทางเข้าหนึ่ง
// อ่าน ADMIN_PASSWORD จาก server/.env ให้เอง จะได้ไม่ต้องพิมพ์รหัสทุกครั้งที่เปิด studio
// (ไฟล์อยู่ในเครื่อง ไม่เข้า git — ไม่ log ค่าออกมาไม่ว่ากรณีใด)
function adminPwFromEnvFile() {
  for (const f of ['.env', '.env.local']) {
    try {
      const m = fs.readFileSync(path.join(ROOT, 'server', f), 'utf8')
        .match(/^\s*ADMIN_PASSWORD\s*=\s*(.*)$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    } catch { }
  }
  return null;
}
let ADMIN_PW = process.env.ADMIN_PASSWORD || adminPwFromEnvFile();
const isAuthed = () => !!(ADMIN_TOKEN || ADMIN_PW);

// ── data helpers ─────────────────────────────────────────────────────────────
function loadCatalog() {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'marketplace-images', 'catalog.json'), 'utf8')).products; }
  catch { return []; }
}

/**
 * กันเลือก "ชุดรูป marketplace" ผิดตัว — code เดียวกันมีได้สินค้าเดียว
 * ถ้าเลือกผิด รูปกลาง products/<code>/ บน R2 (ลิงก์ที่ xlsx ทุกแพลตฟอร์มใช้) จะถูกทับด้วยรูปสินค้าอื่น
 * และชื่อใน catalog จะเพี้ยน (เคยทำ tracklist QR ยิงทับ URL ของสินค้าตัวอื่นมาแล้ว)
 */
function assertCodeFree(code, slug, name) {
  const e = loadCatalog().find(p => p.code === code);
  if (!e || !e.slug || e.slug === slug) return;
  throw new Error(`ชุดรูป code ${code} เป็นของสินค้าอื่นอยู่แล้ว: "${(e.title || e.dirName || '').slice(0, 60)}" (โฟลเดอร์รูป ${e.slug})
` +
    `ถ้า "${String(name || slug).slice(0, 40)}" เป็นสินค้าคนละตัว ให้เลือก code ว่างตัวอื่น — ทำต่อจะทับรูปกลางบน R2 ของสินค้าเดิม`);
}

/** เลขชุดรูป marketplace ของโฟลเดอร์รูปนี้ — ให้หน้าเว็บไม่ต้องเลือก code เองทุกครั้ง */
function codeForSlug(imgSlug) {
  if (!imgSlug) return null;
  const e = loadCatalog().find(p => p.slug === imgSlug);
  return e ? e.code : null;
}

/** สินค้าที่อยู่บนเว็บจริง (จาก products.json — เร็ว ไม่ต้องยิง API) */
function loadWebProducts() {
  try {
    // อ่านสดทุกครั้ง — require() จะ cache ทำให้ไม่เห็นผลหลัง sync-products-json
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8')).map(p => ({
      id: p.id, name: p.name, slug: p.slug, price: p.price, stock: p.stock,
      sku: p.sku, category: p.category?.name || p.category || '', imageUrl: p.imageUrl,
      images: p.images || [], tags: p.tags || [], tracklist: p.tracklist || [],
      description: p.description || '', specs: p.specs || null,
      imgSlug: (p.imageUrl || '').split('/')[3] || '',
    }));
  } catch { return []; }
}

/** สินค้าฝั่ง marketplace (catalog + ราคา/สต็อกจาก listings) */
function loadProducts() {
  const catalog = loadCatalog();
  const listFile = path.join(OUT_DIR, 'marketplace-listings.xlsx');
  const meta = {};
  if (fs.existsSync(listFile)) {
    const wb = XLSX.read(fs.readFileSync(listFile), { type: 'buffer' });
    for (const r of XLSX.utils.sheet_to_json(wb.Sheets['TikTok Shop'] || {}, { defval: '' })) {
      meta[String(r.Code).padStart(2, '0')] = { price: r['ราคา'], stock: r['สต็อก'], sku: r['SKU'], note: r['หมายเหตุ'] };
    }
  }
  return catalog.map(p => ({ code: p.code, title: p.title, slug: p.slug || '', dirName: p.dirName || '', images: p.images, count: p.images.length, ...(meta[p.code] || {}) }));
}

function nasFolders() {
  try {
    return fs.readdirSync(NAS_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => {
      let n = 0;
      try { n = fs.readdirSync(path.join(NAS_DIR, d.name)).filter(f => /\.(jpe?g|png|webp|avif)$/i.test(f)).length; } catch { }
      return { name: d.name, count: n };
    }).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  } catch { return null; }   // null = เข้าถึง NAS ไม่ได้
}

function nextCode() {
  const fromNas = (nasFolders() || []).map(f => parseInt((f.name.match(/^(\d+)/) || [])[1] || '0', 10));
  const fromCat = loadCatalog().map(p => parseInt(p.code, 10) || 0);
  return String(Math.max(0, ...fromNas, ...fromCat) + 1).padStart(2, '0');
}

function runScript(script, args = []) {
  return execFileSync(process.execPath, [path.join(__dirname, script), ...args], { cwd: ROOT, stdio: 'pipe' }).toString();
}

function runCmd(cmd, args, opts = {}) {
  // ห้ามใช้ shell:true — บน Windows มันเอา args มาต่อสตริงโดยไม่ escape
  // ข้อความ commit ที่มีช่องว่าง (ชื่อสินค้าไทย) เลยแตกเป็นหลาย pathspec แล้ว git ล้ม
  // npm/npx บน Windows เป็น .cmd → เรียกชื่อเต็มแทนการพึ่ง shell
  // Node 20+ บน Windows ไม่ยอม spawn ไฟล์ .cmd ตรง ๆ อีกแล้ว (spawnSync npm.cmd EINVAL)
  // → เรียก npm-cli.js ด้วย node แทน ได้ทั้งความปลอดภัยของ args และไม่ต้องพึ่ง shell
  if (process.platform === 'win32' && /^(npm|npx)$/.test(cmd)) {
    const cli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', cmd === 'npx' ? 'npx-cli.js' : 'npm-cli.js');
    if (fs.existsSync(cli)) return execFileSync(process.execPath, [cli, ...args], { cwd: ROOT, stdio: 'pipe', shell: false, ...opts }).toString();
  }
  const exe = process.platform === 'win32' && /^(npm|npx|yarn|pnpm)$/.test(cmd) ? `${cmd}.cmd` : cmd;
  return execFileSync(exe, args, { cwd: ROOT, stdio: 'pipe', shell: false, ...opts }).toString();
}

// ── build + git ──────────────────────────────────────────────────────────────
/** npm run build — inline products/categories/jsonld + sitemap + hash cache-busting */
function runBuild() {
  runCmd('npm', ['run', 'build']);
}

/**
 * commit + push (user อนุญาต auto push ขึ้น main แล้ว — ดู CLAUDE.md §9)
 * ต้อง push ก่อนที่ DB จะชี้มาที่รูปใหม่ ไม่งั้น production 404
 */
function gitPush(message, newPaths = []) {
  try {
    // -u = ไฟล์ที่ track อยู่แล้วและถูกแก้ (html/css/products.json/sitemap ที่ build แตะ)
    runCmd('git', ['add', '-u']);
    // path เพิ่มเติมสำหรับไฟล์ใหม่ที่ยังไม่ถูก track เช่นโฟลเดอร์รูปเว็บชุดใหม่
    // (marketplace-images/ · templates/ · qr/ อยู่ใน .gitignore — ห้ามใส่ ไม่งั้น git add ล้ม)
    for (const p of newPaths) {
      try { runCmd('git', ['add', '--', p]); } catch { }
    }
    const staged = runCmd('git', ['diff', '--cached', '--name-only']).trim();
    if (!staged) return { pushed: false, reason: 'ไม่มีไฟล์เปลี่ยน' };
    const files = staged.split('\n');
    runCmd('git', ['commit', '-m', message]);
    runCmd('git', ['push']);
    return { pushed: true, count: files.length, files: files.slice(0, 8) };
  } catch (e) {
    return { pushed: false, reason: (e.stderr ? String(e.stderr) : e.message).slice(0, 300) };
  }
}

// ── xlsx แพลตฟอร์ม ───────────────────────────────────────────────────────────
function genFile(platform, code) {
  code = String(code).padStart(2, '0');
  if (platform === 'shopee') { runScript('fill-shopee-template.js', ['--apply', '--code', code]); return path.join(OUT_DIR, `shopee-upload-${code}.xlsx`); }
  if (platform === 'tiktok') { runScript('fill-tiktok-template.js', ['--apply', '--code', code]); return path.join(OUT_DIR, `tiktok-upload-${code}.xlsx`); }
  if (platform === 'lazada') {
    const wb0 = XLSX.read(fs.readFileSync(path.join(OUT_DIR, 'marketplace-listings.xlsx')), { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(wb0.Sheets['Lazada'], { header: 1, defval: '' });
    const hit = rows.filter((r, i) => i === 0 || String(r[0]).padStart(2, '0') === code);
    if (hit.length < 2) throw new Error(`ไม่พบ code ${code} ในชีต Lazada`);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(hit);
    ws['!cols'] = [6, 60, 50, 80, 30, 8, 6, 10, 12, 10, 5, 5, 5, ...Array(9).fill(45), 8, 30].map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, 'Lazada');
    const out = path.join(OUT_DIR, `lazada-upload-${code}.xlsx`);
    XLSX.writeFile(wb, out, { bookType: 'xlsx' });
    return out;
  }
  throw new Error('platform ไม่ถูกต้อง');
}

/** สร้าง xlsx ครบทุกแพลตฟอร์มรวดเดียว — คืนรายการที่สำเร็จ/พลาด */
function genAll(code) {
  // ขั้นนี้ล้ม = xlsx ได้ข้อมูลเก่าของสินค้าตัวอื่น ห้ามกลืน error เงียบ ๆ
  try { runScript('generate-marketplace-listings.js', ['--apply']); }
  catch (e) { log('⚠ สร้าง marketplace-listings ไม่สำเร็จ: ' + String(e.stderr || e.message).slice(0, 300)); }
  const out = [];
  for (const platform of ['shopee', 'tiktok', 'lazada']) {
    try { out.push({ platform, file: path.basename(genFile(platform, code)), ok: true }); }
    catch (e) { out.push({ platform, ok: false, error: (e.stderr ? String(e.stderr) : e.message).slice(0, 200) }); }
  }
  return out;
}

// ── QR: คลังเก็บ + สร้าง ─────────────────────────────────────────────────────
const QR_DIR = path.join(ROOT, 'qr');
const QR_REG = path.join(QR_DIR, 'qr-registry.json');
const loadQrReg = () => { try { return JSON.parse(fs.readFileSync(QR_REG, 'utf8')); } catch { return []; } };
const saveQrReg = (items) => { fs.mkdirSync(QR_DIR, { recursive: true }); fs.writeFileSync(QR_REG, JSON.stringify(items, null, 2), 'utf8'); };

function uploadToR2(localFile, remoteKey) {
  const out = runScript('upload-r2-file.js', [localFile, remoteKey, '--force']);
  const m = out.match(/https:\/\/\S+/);
  if (!m) throw new Error('อัป R2 ไม่สำเร็จ: ' + out.slice(0, 300));
  return m[0];
}

async function makeQr({ name, url }) {
  const safe = String(name || 'qr').trim().replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 60) || 'qr';
  const file = `qr-${safe}.png`;
  fs.mkdirSync(QR_DIR, { recursive: true });
  await QRCode.toFile(path.join(QR_DIR, file), url, {
    errorCorrectionLevel: 'H', width: 1200, margin: 3,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
  const items = loadQrReg().filter(i => i.file !== file);
  items.unshift({ name: String(name || safe), url, file, createdAt: new Date().toISOString() });
  saveQrReg(items);
  return { name: String(name || safe), url, file };
}

// ── API เว็บจริง ─────────────────────────────────────────────────────────────
async function api(pathname, opts = {}) {
  const r = await fetch(API_BASE + pathname, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(ADMIN_TOKEN ? { authorization: `Bearer ${ADMIN_TOKEN}` } : {}),
      ...(ADMIN_PW ? { 'x-admin-password': ADMIN_PW } : {}),
      ...(opts.headers || {}),
    },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `${r.status} ${r.statusText}`);
  return body;
}

function readBody(req, limit = 120 * 1024 * 1024) {
  return new Promise((ok, no) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { no(new Error('ไฟล์ใหญ่เกินไป')); req.destroy(); } chunks.push(c); });
    req.on('end', () => ok(Buffer.concat(chunks)));
    req.on('error', no);
  });
}

// ── NAS ─────────────────────────────────────────────────────────────────────
const nasReady = () => { try { return fs.existsSync(NAS_DIR); } catch { return false; } };

/**
 * เก็บต้นฉบับลง NAS ถ้าไดรฟ์ต่ออยู่ — ต่อไม่ได้ก็ไม่ล้ม (ต้นฉบับขึ้น R2 อยู่แล้ว)
 * @returns {string|null} ชื่อโฟลเดอร์ NAS ที่เขียนได้
 */
function saveToNas(folderName, files, log) {
  if (!nasReady()) { log('⚠ NAS ไม่ได้ต่อ — ข้ามการเก็บลง NAS (ต้นฉบับยังขึ้น R2 ครบ)'); return null; }
  try {
    const dir = path.join(NAS_DIR, folderName);
    fs.mkdirSync(dir, { recursive: true });
    const written = new Set();
    files.forEach((f, i) => {
      const ext = (path.extname(f.name) || '.jpg').toLowerCase();
      const name = `หลัก_${String(i + 1).padStart(2, '0')}${ext}`;
      fs.writeFileSync(path.join(dir, name), f.body);
      written.add(name);
    });
    // รูปเก่าที่เกินจำนวนใหม่ต้องลบ (ลบรูปทิ้งแล้ว หลัก_05 ค้าง = รอบหน้าอ่านกลับมาใหม่)
    // แตะเฉพาะไฟล์รูป — รายชื่อเพลง.txt ในโฟลเดอร์เดียวกันต้องอยู่ครบ
    for (const f of fs.readdirSync(dir)) {
      if (/\.(jpe?g|png|webp|avif|tiff?|bmp)$/i.test(f) && !written.has(f)) fs.unlinkSync(path.join(dir, f));
    }
    log(`✔ เก็บต้นฉบับลง NAS: ${folderName} (${files.length} รูป)`);
    return folderName;
  } catch (e) {
    log('⚠ เขียน NAS ไม่สำเร็จ: ' + String(e.message).slice(0, 120));
    return null;
  }
}

// ── server ───────────────────────────────────────────────────────────────────
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const json = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
  const logs = [];
  const log = (m) => { logs.push(m); console.log('  ' + m); };

  try {
    if (url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
    if (url.pathname === '/studio.js') { res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }); return res.end(CLIENT_JS); }

    if (url.pathname === '/api/meta') {
      return json(200, {
        folders: nasFolders(), categories: CATEGORIES, nextCode: nextCode(),
        loggedIn: isAuthed(), nas: NAS_DIR, apiBase: API_BASE,
      });
    }
    if (url.pathname === '/api/products') return json(200, loadProducts());
    if (url.pathname === '/api/web-products') return json(200, loadWebProducts());
    if (url.pathname === '/api/auth-status') return json(200, { loggedIn: isAuthed() });
    if (url.pathname === '/api/qr-list') return json(200, loadQrReg());

    // วิจัยศิลปินด้วย claude CLI (ใช้ Max quota ของ user — ไม่ยิง Anthropic API)
    // รับเป็นรายชื่อเพลงดิบ → ใช้ extractArtists เดียวกับ seo.js แล้ววิจัยทุกชื่อที่ไม่ติด cache
    if (url.pathname === '/api/ai-research' && req.method === 'POST') {
      const { extractArtists } = require('./lib/seo');
      const { researchArtists } = require('./lib/ai-artist-spawn');
      const b = JSON.parse(await readBody(req));
      // ชื่อสั้นที่ผู้ใช้พิมพ์ต้องถูกวิจัยด้วยเสมอ — สินค้าหลายตัวชื่อ = ชื่อคนทำคอนเทนต์
      // (เช่น "อาจารย์ยอด") ซึ่ง extractArtists() ดึงจาก tracklist ไม่เจอ
      const fromTrack = b.tracklist ? extractArtists(b.tracklist, 15) : (b.artists || []);
      const names = [...new Set([String(b.shortName || '').trim(), ...fromTrack].filter(Boolean))];
      if (!names.length) return json(200, { ok: [], skipped: [], errors: [], msg: 'ยังไม่มีชื่อให้วิจัย — พิมพ์ชื่อสินค้าก่อน' });
      log(`⏳ วิจัย ${names.length} ชื่อ: ${names.join(', ')}`);
      const out = require('./lib/ai-artist-spawn').researchArtists(names.slice(0, 10), { force: !!b.force });
      return json(200, out);
    }

    if (url.pathname === '/api/login' && req.method === 'POST') {
      const { email, password } = JSON.parse(await readBody(req));

      // 1) อีเมล + รหัสผ่าน (ใช้ได้เฉพาะบัญชีที่ตั้งรหัสไว้ ไม่ใช่บัญชี Google ล้วน)
      let jwtErr = null;
      if (email) {
        try {
          const out = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
          if (out.user?.role !== 'ADMIN') throw new Error('บัญชีนี้ไม่ใช่แอดมิน');
          ADMIN_TOKEN = out.token;
          console.log(`✔ login แอดมิน: ${out.user.email}`);
          return json(200, { ok: true, via: 'jwt' });
        } catch (e) { jwtErr = e; }
      }

      // 2) ตกมาที่ ADMIN_PASSWORD — ยิงเส้นที่ต้องเป็นแอดมินเพื่อพิสูจน์ว่ารหัสถูก
      const prev = ADMIN_PW;
      ADMIN_PW = password;
      try {
        await api('/orders?limit=1');
        console.log('✔ login แอดมิน: ผ่าน ADMIN_PASSWORD');
        return json(200, { ok: true, via: 'admin-password' });
      } catch (e) {
        ADMIN_PW = prev;
        throw new Error(jwtErr ? `${jwtErr.message} · รหัสแอดมินก็ไม่ผ่าน (${e.message})` : e.message);
      }
    }

    // ── SEO อย่างเดียว (เร็ว ไม่แตะรูป) — ใช้ทั้งตอนลงใหม่และตอนแก้ไข ──
    if (url.pathname === '/api/seo' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req));
      const seo = buildSeo({
        shortName: b.shortName, tracklist: b.tracklist || [],
        capacity: b.capacity, price: b.price, categoryName: b.categoryName,
      });
      const others = loadWebProducts().filter(p => p.id !== b.excludeId);
      return json(200, { ...seo, issues: validateSeo(seo, others) });
    }

    // ── ลงสินค้าใหม่: เตรียมรูป + SEO → คืน draft ──
    if (url.pathname === '/api/new-product' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req));
      const shortName = String(b.name || '').trim().replace(/[\\/:*?"<>|]/g, '');
      if (!shortName) throw new Error('ไม่มีชื่อสินค้า');
      // เช็คสิทธิ์ตั้งแต่ต้น — ไม่งั้นทำรูป/อัป R2 เสร็จหมดแล้วค่อยไปตายตอนเขียน DB
      // ทิ้งโฟลเดอร์รูปค้างไว้ รอบหน้าชื่อเลยกลายเป็น -2 -3 -4
      if (!isAuthed()) throw new Error('ยังไม่ได้เข้าสู่ระบบแอดมิน — ล็อกอินก่อนเริ่มเตรียมรูป');

      const tracklist = Array.isArray(b.tracklist) ? b.tracklist : [];
      const seo = buildSeo({ shortName, tracklist, capacity: b.capacity || '4GB', price: b.price || 279, categoryName: b.categoryName });
      const slug = uniqueImageSlug(seo.imageSlug, webImg.listWebDirs());

      let code, folderName, sources = null, srcDir = null;
      if (b.folder) {                       // ต้นฉบับอยู่บน NAS อยู่แล้ว
        folderName = b.folder;
        code = (folderName.match(/^(\d+)/) || [])[1];
        if (!code) throw new Error('ชื่อโฟลเดอร์ต้องขึ้นต้นด้วยเลข เช่น "57-ชื่อสินค้า"');
        code = code.padStart(2, '0');
        srcDir = path.join(NAS_DIR, folderName);
        if (!fs.existsSync(srcDir)) throw new Error(`เปิดโฟลเดอร์ไม่ได้: ${srcDir} (NAS ต่ออยู่ไหม)`);
      } else {                              // อัปโหลดผ่านเว็บ — ใช้ได้แม้ NAS ไม่ต่อ
        if (!Array.isArray(b.images) || !b.images.length) throw new Error('ไม่มีรูป');
        code = nextCode();
        folderName = `${code}-${shortName}`;
        sources = b.images.slice(0, 9).map(im => ({ name: im.name || 'image.jpg', body: Buffer.from(im.data, 'base64') }));
        saveToNas(folderName, sources, log);
      }

      if (tracklist.length && nasReady()) {
        try { fs.writeFileSync(path.join(NAS_DIR, folderName, 'รายชื่อเพลง.txt'), tracklist.join('\r\n'), 'utf8'); } catch { }
      }

      assertCodeFree(code, slug, seo.name);

      log('⏳ ต้นฉบับ → R2 · รูปกลาง 1200 → R2 · รูปเว็บ webp+avif …');
      const img = await processProductImages({ code, slug, title: seo.name, srcDir, sources, dirName: folderName, log });

      return json(200, {
        ...seo, code, folderName, tracklist, slugBase: seo.slug,
        images: img.web, r2Images: img.mid, originals: img.originals, imgSlug: slug,
        issues: validateSeo(seo, loadWebProducts()), logs,
      });
    }

    // ── ยืนยันลงเว็บ ──
    if (url.pathname === '/api/publish' && req.method === 'POST') {
      // isAuthed() ไม่ใช่ ADMIN_TOKEN — ล็อกอินด้วย ADMIN_PASSWORD ก็ยิง API ได้ (ดู api() ส่ง x-admin-password)
      if (!isAuthed()) throw new Error('ยังไม่ได้เข้าสู่ระบบแอดมิน');
      const b = JSON.parse(await readBody(req));

      // 1) push รูปเว็บขึ้น production ก่อน — DB ชี้มาก่อนไฟล์ขึ้น = รูป 404
      log('⏳ build + push รูปขึ้น production…');
      runBuild();
      const g1 = gitPush(`feat(product): รูปสินค้าใหม่ ${b.imgSlug}`, ['images/products']);
      log(g1.pushed ? `✔ push รูปแล้ว (${g1.count} ไฟล์)` : `⚠ ไม่ได้ push: ${g1.reason}`);

      // 2) สร้างสินค้าใน DB
      const product = await api('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: b.name, price: b.price, stock: b.stock ?? 100, categoryName: b.categoryName,
          imageUrl: b.images[0], images: b.images, brand: 'btmusicdrive', sku: `BT-${b.code}`,
          tags: b.tags, tracklist: b.tracklist, specs: b.specs || { capacity: b.capacity },
          description: b.description, slug: b.slug || slugify(b.name),
        }),
      });
      log(`🎉 ลงเว็บสำเร็จ: ${product.name}`);

      // 3) sync products.json → build → push (สินค้าใหม่เข้า sitemap/JSON-LD/fallback)
      try { runScript('sync-products-json.js'); log('✔ sync products.json'); }
      catch (e) { log('⚠ sync products.json ไม่สำเร็จ: ' + String(e.stderr || e.message).slice(0, 300)); }
      try {
        runBuild();
        const g2 = gitPush(`feat(product): ${product.name}`);
        log(g2.pushed ? `✔ push products.json + sitemap แล้ว (${g2.count} ไฟล์)` : `⚠ ไม่ได้ push: ${g2.reason}`);
      } catch (e) { log('⚠ build ไม่สำเร็จ: ' + String(e.message).slice(0, 150)); }

      // 4) QR รายชื่อเพลง — หน้าเว็บบน R2 + QR พร้อมพิมพ์ (URL ผูกกับ code ยิงซ้ำทับได้)
      let qr = null;
      if (Array.isArray(b.tracklist) && b.tracklist.length) {
        try {
          qr = await makeTracklistQr({ code: b.code, name: product.name, tracklist: b.tracklist });
          log(`✔ QR รายชื่อเพลง: qr/${qr.file}`);
        } catch (e) { log('⚠ สร้าง QR รายชื่อเพลงไม่สำเร็จ: ' + String(e.message).slice(0, 150)); }
      }

      // 5) xlsx ทุกแพลตฟอร์ม พร้อมดาวน์โหลด
      const files = genAll(b.code);
      log(`✔ สร้าง xlsx: ${files.filter(f => f.ok).map(f => f.platform).join(', ') || '—'}`);

      return json(200, {
        ok: true, slug: product.slug, id: product.id,
        url: `https://btmusicdrive.com/product/${product.slug}`, files, qr, logs,
      });
    }

    // ── จัดการรูปสินค้าเดิม: เพิ่ม / ลบ / สลับลำดับ ในครั้งเดียว ──
    // ดึงต้นฉบับเดิมจาก R2 (หรือ NAS ถ้าต่ออยู่) → คัด+เรียงตาม keep → ต่อรูปใหม่ →
    // ทำรูปใหม่ครบ 3 ชั้น แล้ว push รูปก่อน ค่อย PATCH images ใน DB (DB ชี้มาก่อนไฟล์ขึ้น = รูป 404)
    if (url.pathname === '/api/add-images' && req.method === 'POST') {
      if (!isAuthed()) throw new Error('ยังไม่ได้เข้าสู่ระบบแอดมิน — ล็อกอินก่อนเพิ่มรูป');
      const b = JSON.parse(await readBody(req));
      if (!b.id) throw new Error('ไม่มี id สินค้า');
      const slug = b.imgSlug;
      if (!slug) throw new Error('ไม่รู้โฟลเดอร์รูปของสินค้านี้');
      // เดาเลขชุดรูปจาก catalog ให้เอง ถ้าหน้าเว็บไม่ได้ส่งมา
      const code = String(b.code || codeForSlug(slug) || '').padStart(2, '0');
      if (!/^\d{2,}$/.test(code)) throw new Error('ไม่รู้เลขชุดรูป marketplace ของสินค้านี้ — เลือกจากรายการด้านล่างก่อน');
      assertCodeFree(code, slug, b.name);
      const incoming = (Array.isArray(b.images) ? b.images : [])
        .map(im => ({ name: im.name || 'image.jpg', body: Buffer.from(im.data, 'base64') }));

      // ต้นฉบับเดิม: NAS ก่อน (ไฟล์ดิบอยู่ใกล้กว่า) ไม่งั้นดึงกลับจาก R2
      let old = [];
      const nasDir = b.folder && nasReady() ? path.join(NAS_DIR, b.folder) : null;
      if (nasDir && fs.existsSync(nasDir)) {
        old = webImg.listSourceImages(nasDir).map(f => ({ name: path.basename(f), body: fs.readFileSync(f) }));
        log(`✔ ต้นฉบับเดิมจาก NAS ${old.length} ใบ`);
      } else {
        old = await fetchOriginals(code, slug);
        log(old.length ? `✔ ดึงต้นฉบับเดิมจาก R2 ${old.length} ใบ` : '⚠ ไม่พบต้นฉบับเดิมบน R2 — จะได้เฉพาะรูปใหม่');
      }

      // keep = index ของรูปเดิมที่เก็บไว้ เรียงตามลำดับใหม่ที่ผู้ใช้ลากไว้ (ไม่ส่งมา = เก็บทั้งหมดตามเดิม)
      let kept = old;
      if (Array.isArray(b.keep)) {
        const valid = b.keep.map(Number).filter(i => Number.isInteger(i) && i >= 0 && i < old.length);
        if (new Set(valid).size !== valid.length) throw new Error('ลำดับรูปซ้ำกัน — รีเฟรชหน้าแล้วลองใหม่');
        kept = valid.map(i => old[i]);
        const dropped = old.length - kept.length;
        if (dropped > 0) log(`✔ ลบรูปเดิมออก ${dropped} ใบ · เหลือ ${kept.length} ใบ`);
      }
      const sources = kept.concat(incoming);
      if (!sources.length) throw new Error('ต้องเหลือรูปอย่างน้อย 1 ใบ');
      if (sources.length > 9) log(`⚠ รวมแล้ว ${sources.length} ใบ — เก็บ 9 ใบแรก (เพดานของ Shopee/TikTok)`);
      log('⏳ ทำรูปใหม่ครบ 3 ชั้น (ต้นฉบับ R2 · รูปกลาง 1200 · รูปเว็บ webp+avif) …');
      const img = await processProductImages({ code, slug, title: b.name || slug, sources, dirName: b.folder, log });

      // เขียนต้นฉบับ "ทั้งชุด" ลง NAS ใหม่ ถ้าไดรฟ์ต่ออยู่ — ชื่อไฟล์ หลัก_NN ต้องเรียงตรงกับลำดับรูปเว็บ
      // (ส่ง incoming อย่างเดียวไม่ได้ จะทับ หลัก_01 ของเดิม)
      if (b.folder) saveToNas(b.folder, sources.slice(0, 9), log);

      runBuild();
      const g = gitPush(`feat(images): จัดรูป ${slug} (${img.web.length} ใบ)`, ['images/products']);
      log(g.pushed ? `✔ push รูปแล้ว (${g.count} ไฟล์)` : `⚠ ไม่ได้ push: ${g.reason} — อย่าเพิ่งเปิดหน้าสินค้า รูปจะ 404`);

      const out = await api(`/products/${b.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ images: img.web, imageUrl: img.web[0] }),
      });
      log(`✔ อัปเดตรูปในฐานข้อมูล: ${out.name || b.name} (${img.web.length} ใบ)`);

      try { runScript('sync-products-json.js'); log('✔ sync products.json'); }
      catch (e) { log('⚠ sync products.json ไม่สำเร็จ: ' + String(e.stderr || e.message).slice(0, 300)); }
      try {
        runBuild();
        const g2 = gitPush(`feat(images): products.json รูปใหม่ ${slug}`);
        log(g2.pushed ? `✔ push products.json แล้ว (${g2.count} ไฟล์)` : `⚠ ไม่ได้ push: ${g2.reason}`);
      } catch (e) { log('⚠ build ไม่สำเร็จ: ' + String(e.message).slice(0, 150)); }

      return json(200, { ok: true, images: img.web, mid: img.mid, logs });
    }

    // ── ซิงก์รูปในโฟลเดอร์เว็บเข้า DB ──
    // กู้กรณีทำรูปเสร็จแล้วแต่ขั้น build/push/DB ล้มกลางทาง (ไฟล์รูปมีครบแล้ว ไม่ต้องทำใหม่)
    if (url.pathname === '/api/sync-images' && req.method === 'POST') {
      if (!isAuthed()) throw new Error('ยังไม่ได้เข้าสู่ระบบแอดมิน');
      const b = JSON.parse(await readBody(req));
      if (!b.id || !b.imgSlug) throw new Error('ไม่มี id หรือโฟลเดอร์รูป');
      const urls = webImg.readWebUrls(b.imgSlug);
      if (!urls.length) throw new Error(`ไม่พบรูปใน images/products/${b.imgSlug}/`);
      log(`✔ เจอรูปในโฟลเดอร์ ${urls.length} ใบ`);

      runBuild();
      const g = gitPush(`feat(images): sync รูป ${b.imgSlug}`, ['images/products']);
      log(g.pushed ? `✔ push รูปแล้ว (${g.count} ไฟล์)` : `⚠ ไม่ได้ push: ${g.reason}`);

      const out = await api(`/products/${b.id}`, { method: 'PATCH', body: JSON.stringify({ images: urls, imageUrl: urls[0] }) });
      log(`✔ DB ชี้มาที่รูป ${urls.length} ใบแล้ว: ${out.name || b.id}`);

      try { runScript('sync-products-json.js'); log('✔ sync products.json'); }
      catch (e) { log('⚠ sync products.json ไม่สำเร็จ: ' + String(e.stderr || e.message).slice(0, 300)); }
      try {
        runBuild();
        const g2 = gitPush(`feat(images): products.json ${b.imgSlug}`);
        log(g2.pushed ? `✔ push products.json แล้ว (${g2.count} ไฟล์)` : `⚠ ไม่ได้ push: ${g2.reason}`);
      } catch (e) { log('⚠ build ไม่สำเร็จ: ' + String(e.message).slice(0, 150)); }

      return json(200, { ok: true, images: urls, logs });
    }

    // ── แก้ไขสินค้าเดิม ──
    if (url.pathname === '/api/update' && req.method === 'POST') {
      // isAuthed() ไม่ใช่ ADMIN_TOKEN — ล็อกอินด้วย ADMIN_PASSWORD ก็ยิง API ได้ (ดู api() ส่ง x-admin-password)
      if (!isAuthed()) throw new Error('ยังไม่ได้เข้าสู่ระบบแอดมิน');
      const b = JSON.parse(await readBody(req));
      if (!b.id) throw new Error('ไม่มี id สินค้า');

      const patch = {
        name: b.name, price: b.price, stock: b.stock, categoryName: b.categoryName,
        tags: b.tags, description: b.description, slug: b.slug,
      };
      if (b.specs) patch.specs = b.specs;
      if (Array.isArray(b.tracklist) && b.tracklist.length) patch.tracklist = b.tracklist;
      // Product Studio ส่งลำดับรูปมาโดยตรง; รูปแรกเป็นรูปปกสินค้า
      if (Array.isArray(b.images) && b.images.length) {
        patch.images = b.images;
        patch.imageUrl = b.imageUrl || b.images[0];
      }

      // เมื่อเปลี่ยนชื่อสินค้า ให้เปลี่ยนชื่อโฟลเดอร์/ไฟล์รูปตามอัตโนมัติ
      // (ไม่ต้องสร้าง SEO ก่อน) แล้ว push ก่อนค่อยชี้ DB มาที่ URL ใหม่
      const requestedImageSlug = imageSlug(b.name || 'product');
      if (b.renameImages && b.oldImgSlug && b.oldImgSlug !== requestedImageSlug) {
        const newSlug = uniqueImageSlug(requestedImageSlug, webImg.listWebDirs(), b.oldImgSlug);
        const r = webImg.renameWebImages(b.oldImgSlug, newSlug);
        log(`✔ เปลี่ยนชื่อรูป: ${b.oldImgSlug} → ${newSlug} (${r.urls.length} ใบ)`);
        // ถ้าสลับตำแหน่งรูปในหน้าสตูดิโอ ให้รักษาลำดับที่เลือกไว้หลัง rename ด้วย
        const oldPrefix = `/images/products/${b.oldImgSlug}/`;
        const newPrefix = `/images/products/${newSlug}/`;
        const reordered = Array.isArray(b.images) && b.images.length
          ? b.images.map((u) => String(u).replace(oldPrefix, newPrefix))
          : r.urls;
        patch.images = reordered;
        patch.imageUrl = reordered[0];
        runBuild();
        const g = gitPush(`refactor(images): rename ${b.oldImgSlug} → ${newSlug}`, ['images/products']);
        log(g.pushed ? '✔ push รูปชื่อใหม่แล้ว' : `⚠ ไม่ได้ push: ${g.reason} — อย่าเพิ่งเปิดหน้าสินค้า รูปจะ 404 จนกว่าจะ push`);
      }

      const out = await api(`/products/${b.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      log(`✔ อัปเดตสินค้า: ${out.name || b.name}`);

      try { runScript('sync-products-json.js'); log('✔ sync products.json'); }
      catch (e) { log('⚠ sync products.json ไม่สำเร็จ: ' + String(e.stderr || e.message).slice(0, 300)); }
      try {
        runBuild();
        const g = gitPush(`content(product): แก้ไข ${b.name}`);
        log(g.pushed ? `✔ push ข้อมูลใหม่แล้ว (${g.count} ไฟล์)` : `⚠ ไม่ได้ push: ${g.reason}`);
      } catch (e) { log('⚠ build ไม่สำเร็จ: ' + String(e.message).slice(0, 150)); }

      const files = b.code ? genAll(b.code) : [];
      return json(200, { ok: true, slug: out.slug || b.slug, url: `https://btmusicdrive.com/product/${out.slug || b.slug}`, files, logs });
    }

    // ── xlsx ──
    if (url.pathname === '/api/gen-all' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req));
      return json(200, { files: genAll(String(b.code).padStart(2, '0')) });
    }

    if (url.pathname === '/api/generate') {
      const file = genFile(url.searchParams.get('platform'), url.searchParams.get('code'));
      res.writeHead(200, {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'x-filename': path.basename(file),
        'content-disposition': `attachment; filename="${path.basename(file)}"`,
      });
      console.log(`✔ ${url.searchParams.get('platform')} code ${url.searchParams.get('code')} → ${path.basename(file)}`);
      return res.end(fs.readFileSync(file));
    }

    if (url.pathname === '/api/download') {
      const f = path.join(OUT_DIR, path.basename(url.searchParams.get('file') || ''));
      if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${path.basename(f)}"`,
      });
      return res.end(fs.readFileSync(f));
    }

    // ── QR ──
    if (url.pathname.startsWith('/qr/')) {
      const f = path.join(QR_DIR, path.basename(decodeURIComponent(url.pathname)));
      if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'content-type': 'image/png' });
      return res.end(fs.readFileSync(f));
    }

    if (url.pathname === '/api/qr-create' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req));
      let target = b.url;
      if (b.file) {
        const ext = (b.file.name.match(/\.[a-z0-9]+$/i) || ['.pdf'])[0].toLowerCase();
        const safe = String(b.name).trim().replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 60);
        const docsDir = path.join(ROOT, 'marketplace-docs');
        fs.mkdirSync(docsDir, { recursive: true });
        const local = path.join(docsDir, safe + ext);
        fs.writeFileSync(local, Buffer.from(b.file.data, 'base64'));
        console.log(`✔ เก็บไฟล์: marketplace-docs/${safe}${ext}`);
        if (ext === '.txt') {
          const htmlLocal = path.join(docsDir, safe + '.html');
          fs.writeFileSync(htmlLocal, tracklistHtml(b.name, Buffer.from(b.file.data, 'base64').toString('utf8')), 'utf8');
          target = uploadToR2(htmlLocal, `docs/${safe}.html`);
        } else {
          target = uploadToR2(local, `docs/${safe}${ext}`);
        }
        console.log(`✔ R2: ${target}`);
      }
      if (!/^https?:\/\//.test(String(target || ''))) throw new Error('ไม่มีลิงก์หรือไฟล์');
      const item = await makeQr({ name: b.name, url: target });
      console.log(`✔ QR: qr/${item.file} → ${target}`);
      return json(200, item);
    }

    // รูปเว็บ local (พรีวิวใน studio)
    if (url.pathname.startsWith('/images/')) {
      const f = path.join(ROOT, decodeURIComponent(url.pathname));
      if (!f.startsWith(path.join(ROOT, 'images')) || !fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
      const ext = path.extname(f).toLowerCase();
      res.writeHead(200, { 'content-type': ext === '.avif' ? 'image/avif' : ext === '.webp' ? 'image/webp' : 'image/jpeg' });
      return res.end(fs.readFileSync(f));
    }

    res.writeHead(404); res.end('not found');
  } catch (e) {
    const msg = (e.stderr ? String(e.stderr) : '') || e.message;
    console.error('✖', msg);
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(logs.length ? logs.join('\n') + '\n\n✖ ' + msg : msg);
  }
}).listen(PORT, () => {
  console.log(`🎛 Product Studio เปิดแล้ว → http://localhost:${PORT}`);
  console.log(`   API เว็บ: ${API_BASE} · NAS: ${NAS_DIR}`);
  console.log('   ➕ ลงสินค้าใหม่ · ✏ แก้ไขสินค้าเดิม · 🔗 QR   (Ctrl+C เพื่อปิด)');

  // ทดสอบรหัสแอดมินตั้งแต่ตอนเปิด จะได้รู้ทันทีว่าใช้ได้ไหม ไม่ต้องไปพังตอนกดบันทึก
  if (ADMIN_PW) {
    api('/orders?limit=1')
      .then(() => console.log('   ✔ รหัสแอดมินจาก server/.env ใช้ได้ — ไม่ต้องล็อกอินซ้ำ'))
      .catch(e => {
        ADMIN_PW = null;
        console.log(`   ✖ รหัสแอดมินใน server/.env ใช้ไม่ได้ (${e.message}) — ต้องล็อกอินในหน้าเว็บ`);
      });
  }
});
