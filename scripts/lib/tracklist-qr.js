/**
 * สร้างหน้ารายชื่อเพลงบน R2 + QR ของสินค้าหนึ่งตัว — ใช้ร่วมกันระหว่าง
 * scripts/generate-tracklist-qrs.js (ทำครบทุกตัว) และ listing-studio.js (ทำตอนลงสินค้าใหม่)
 *
 * URL ผูกกับเลข code เท่านั้น (docs/tracklist-<code>.html) → เปลี่ยนชื่อสินค้าภายหลัง
 * หรือรันซ้ำ QR ที่พิมพ์ไปแล้วก็ยังใช้ได้ (อัปทับหน้าเดิมด้วยข้อมูลล่าสุด)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const QRCode = require('qrcode');
const { tracklistHtml } = require('./tracklist-page');

const ROOT = path.resolve(__dirname, '..', '..');
const DOCS_DIR = path.join(ROOT, 'marketplace-docs');
const QR_DIR = path.join(ROOT, 'qr');
const QR_REG = path.join(QR_DIR, 'qr-registry.json');

const loadQrReg = () => { try { return JSON.parse(fs.readFileSync(QR_REG, 'utf8')); } catch { return []; } };
const saveQrReg = (items) => { fs.mkdirSync(QR_DIR, { recursive: true }); fs.writeFileSync(QR_REG, JSON.stringify(items, null, 2), 'utf8'); };

/** ตัดคำนำหน้าซ้ำ ๆ ("USB แฟลชไดร์ฟ MP3") ออก ให้ชื่อไฟล์ QR ดูออกในโฟลเดอร์ */
function shortProductName(name) {
  return String(name || '')
    .replace(/^usb[\s\-–—]*(แฟลชไดร์?ฟ์?|flash\s*drive)?(พร้อมเพลง)?[\s\-–—]*(mp3)?[\s\-–—]*/i, '')
    .replace(/[\/:*?"<>|]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 40).trim();
}

/**
 * @param {{code:string|number, name:string, tracklist:string[]}} p
 * @returns {Promise<{code:string,url:string,file:string,name:string,tracks:number,kb:number}>}
 */
async function makeTracklistQr({ code, name, tracklist }) {
  code = String(code);
  const tracks = Array.isArray(tracklist) ? tracklist : [];
  if (!tracks.length) throw new Error('ไม่มีรายชื่อเพลง');

  // บาง tracklist มีเลขนำหน้าอยู่แล้ว (เช่น "001. ลุงขี้เมา") — ตัดออกก่อน ไม่ให้เลขซ้อนกัน
  const txt = tracks.map((t, i) => `${i + 1}. ${String(t).replace(/^\s*\d+\s*[.)\-]*\s*/, '').trim()}`).join('\n');
  const html = tracklistHtml(name, txt);
  fs.mkdirSync(DOCS_DIR, { recursive: true });
  const htmlFile = path.join(DOCS_DIR, `tracklist-${code}.html`);
  fs.writeFileSync(htmlFile, html, 'utf8');

  // อัปขึ้น R2 (key คงที่ตาม code)
  const out = execFileSync(process.execPath,
    [path.join(__dirname, '..', 'upload-r2-file.js'), htmlFile, `docs/tracklist-${code}.html`, '--force'],
    { cwd: ROOT, stdio: 'pipe' }).toString();
  const url = (out.match(/https:\/\/\S+/) || [])[0];
  if (!url) throw new Error('อัป R2 ไม่สำเร็จ: ' + out.slice(0, 300));

  const file = `qr-tracklist-${code} ${shortProductName(name)}.png`;
  // ลบไฟล์ชื่อแบบเก่า (ไม่มีชื่อสินค้า) ทิ้ง ไม่ให้ซ้ำซ้อน
  try { fs.unlinkSync(path.join(QR_DIR, `qr-tracklist-${code}.png`)); } catch { }
  fs.mkdirSync(QR_DIR, { recursive: true });
  await QRCode.toFile(path.join(QR_DIR, file), url, {
    errorCorrectionLevel: 'H', width: 1200, margin: 3,
    color: { dark: '#000000', light: '#FFFFFF' },
  });

  // ลงทะเบียนในคลัง QR ของ studio (ล้างรายการเดิมของ code นี้ทุกชื่อไฟล์ก่อน)
  const regName = `${code} รายชื่อเพลง — ${String(name).slice(0, 45)}`;
  const items = loadQrReg().filter(i => {
    const f = String(i.file || '');
    return !(f === file || f === `qr-tracklist-${code}.png` || f.startsWith(`qr-tracklist-${code} `));
  });
  items.unshift({ name: regName, url, file, createdAt: new Date().toISOString() });
  saveQrReg(items);

  return { code, url, file, name: regName, tracks: tracks.length, kb: html.length / 1024 };
}

module.exports = { makeTracklistQr, shortProductName, loadQrReg, saveQrReg, QR_DIR, QR_REG, DOCS_DIR };
