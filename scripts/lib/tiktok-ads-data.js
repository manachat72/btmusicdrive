/**
 * อ่านรายงานโฆษณา TikTok จากโฟลเดอร์ tiktok-ads (อยู่นอก repo — ไม่ขึ้น git)
 * ใช้โดยหน้า "TikTok สรุป / TikTok โฆษณา" ใน Product Studio
 *   TIKTOK_ADS_DIR=...  เปลี่ยนที่ตั้งโฟลเดอร์ (ค่าเริ่มต้น ../tiktok-ads ข้าง repo นี้)
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const DIR = process.env.TIKTOK_ADS_DIR || path.resolve(__dirname, '..', '..', '..', 'tiktok-ads');
const REPORTS = path.join(DIR, 'reports');
const FILE_RE = /^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.json$/;

function latestReport() {
  if (!fs.existsSync(REPORTS)) return { error: 'ไม่พบโฟลเดอร์ ' + DIR + ' — ตั้ง TIKTOK_ADS_DIR หรือรัน npm run report ในโฟลเดอร์ tiktok-ads' };
  const files = fs.readdirSync(REPORTS).filter((f) => FILE_RE.test(f))
    .map((f) => ({ f, t: fs.statSync(path.join(REPORTS, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!files.length) return { error: 'ยังไม่มีรายงาน — กด "อัปเดตข้อมูล"' };
  const d = JSON.parse(fs.readFileSync(path.join(REPORTS, files[0].f), 'utf8'));
  return { file: files[0].f, accounts: d.accounts, range: d.range, generatedAt: d.generatedAt, totals: d.totals,
    daily: d.daily, ordersError: d.ordersError || null };
}

let running = false;
function refresh(days) {
  const n = Math.min(Math.max(parseInt(days, 10) || 30, 1), 730);
  return new Promise((resolve, reject) => {
    if (running) return reject(new Error('กำลังอัปเดตอยู่'));
    running = true;
    execFile(process.execPath, ['report.js', '--days', String(n)], { cwd: DIR, timeout: 180000, maxBuffer: 8e6 }, (err, _o, stderr) => {
      running = false;
      if (err) return reject(new Error((stderr || err.message).split('\n').slice(-3).join(' ').trim()));
      resolve();
    });
  });
}

module.exports = { latestReport, refresh };
