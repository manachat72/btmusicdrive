#!/usr/bin/env node
// Ollama gateway — ด่านหน้าให้บอท LINE/Messenger (Vercel) เรียก Ollama ในเครื่องนี้ผ่าน Cloudflare Tunnel
//
//   Vercel → https://ai.btmusicdrive.com → cloudflared → 127.0.0.1:11435 (ไฟล์นี้) → 127.0.0.1:11434 (Ollama)
//
// Ollama ไม่มีระบบรหัสผ่าน ถ้าเปิด tunnel ตรงเข้า 11434 ใครก็ใช้ GPU เราได้ — gateway นี้จึง
//   - บังคับ Authorization: Bearer <OLLAMA_GATEWAY_KEY> (ค่าเดียวกับ OLLAMA_API_KEY ใน Vercel)
//   - เปิดแค่ POST /api/chat กับ GET /health — pull/delete/create โมเดลจากข้างนอกไม่ได้
// key อ่านจาก env หรือ server/.env.local (ไม่เข้า git) — ห้าม log ค่า key
//
// รัน: npm run ai:gateway   (start-ai-gateway.bat รันทั้ง gateway + tunnel ตอนเปิดเครื่อง)

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.GATEWAY_PORT) || 11435;
const OLLAMA = new URL(process.env.OLLAMA_LOCAL_URL || 'http://127.0.0.1:11434');
const MAX_BODY = 1024 * 1024; // 1mb เท่ากับ body limit ของ server

function keyFromEnvFile() {
  for (const f of ['.env.local', '.env']) {
    try {
      const m = fs.readFileSync(path.join(ROOT, 'server', f), 'utf8')
        .match(/^\s*OLLAMA_GATEWAY_KEY\s*=\s*(.*)$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    } catch { }
  }
  return '';
}

const KEY = process.env.OLLAMA_GATEWAY_KEY || keyFromEnvFile();
if (KEY.length < 32) {
  console.error('[gateway] ต้องตั้ง OLLAMA_GATEWAY_KEY (≥32 ตัว) ใน server/.env.local');
  process.exit(1);
}
const KEY_HASH = crypto.createHash('sha256').update(KEY).digest();

function authorized(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  if (!m) return false;
  const got = crypto.createHash('sha256').update(m[1].trim()).digest();
  return crypto.timingSafeEqual(got, KEY_HASH);
}

function send(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = (req.url || '').split('?')[0];

  if (req.method === 'GET' && url === '/health') {
    // เช็คว่า Ollama ยังตอบอยู่ไหม (ไม่ต้องใช้ key — ไม่เปิดเผยอะไร)
    const probe = http.get(new URL('/api/version', OLLAMA), (r) => {
      r.resume();
      send(res, r.statusCode === 200 ? 200 : 502, { ok: r.statusCode === 200 });
    });
    probe.on('error', () => send(res, 502, { ok: false, error: 'ollama not running' }));
    probe.setTimeout(3000, () => probe.destroy(new Error('timeout')));
    return;
  }

  if (req.method !== 'POST' || url !== '/api/chat') return send(res, 404, { error: 'not found' });
  if (!authorized(req)) return send(res, 401, { error: 'unauthorized' });

  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > MAX_BODY) {
      send(res, 413, { error: 'body too large' });
      req.destroy();
    } else chunks.push(c);
  });
  req.on('end', () => {
    if (res.headersSent) return;
    const body = Buffer.concat(chunks);
    const started = Date.now();
    const up = http.request(new URL('/api/chat', OLLAMA), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': body.length },
    }, (r) => {
      res.writeHead(r.statusCode || 502, { 'content-type': r.headers['content-type'] || 'application/json' });
      r.pipe(res);
      r.on('end', () => console.log(`[gateway] ${new Date().toLocaleTimeString('th-TH')} /api/chat ${r.statusCode} ${Date.now() - started}ms`));
    });
    up.on('error', (err) => {
      console.error('[gateway] ollama error:', err.message);
      if (!res.headersSent) send(res, 502, { error: 'ollama not running' });
    });
    up.end(body);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[gateway] http://127.0.0.1:${PORT} → ${OLLAMA.origin}`);
});
