#!/usr/bin/env node
/**
 * สร้าง QR code PNG ความละเอียดสูงสำหรับพิมพ์ (การ์ด/กล่อง/สติกเกอร์)
 *
 * Usage:
 *   node scripts/make-qr.js <url> [out.png]
 *   node scripts/make-qr.js "https://img.btmusicdrive.com/docs/x.pdf" qr/sek-loso.png
 *
 * ค่าที่ตั้งไว้: 1200×1200px · error correction H (30% — เผื่อแปะโลโก้ทับกลางได้) · ขอบขาว
 */
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

const [url, outArg] = process.argv.slice(2);
if (!url) { console.error('✖ ใช้: node scripts/make-qr.js <url> [out.png]'); process.exit(1); }

const out = outArg || path.join('qr', 'qr-' + Date.now() + '.png');
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });

QRCode.toFile(out, url, {
  errorCorrectionLevel: 'H',
  width: 1200,
  margin: 3,
  color: { dark: '#000000', light: '#FFFFFF' },
}).then(() => {
  console.log(`✔ ${out}  (1200×1200, EC=H — แปะโลโก้กลางได้ ~ไม่เกิน 25% ของพื้นที่)`);
  console.log(`  → ${url}`);
}).catch(e => { console.error('✖', e.message); process.exit(1); });
