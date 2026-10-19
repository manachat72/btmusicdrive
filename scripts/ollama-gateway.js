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
const LLAMA = new URL(process.env.LLAMA_CPP_URL || 'http://127.0.0.1:8080');
const LLAMA_MODEL = process.env.LLAMA_CPP_MODEL || 'qwen3.8-27b';
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

// Vercel ยังเรียก gateway นี้ด้วย Ollama /api/chat format อยู่ จึงแปลงเป็น
// OpenAI-compatible API ของ llama.cpp ที่นี่ โดยไม่เปิด llama-server ออก tunnel โดยตรง.
function toLlamaRequest(payload) {
  const options = payload?.options || {};
  const request = {
    model: LLAMA_MODEL,
    stream: false,
    messages: Array.isArray(payload?.messages) ? payload.messages : [],
  };
  if (Number.isFinite(Number(options.num_predict)) && Number(options.num_predict) > 0) {
    request.max_tokens = Number(options.num_predict);
  }
  if (Number.isFinite(Number(options.temperature))) request.temperature = Number(options.temperature);
  return request;
}

function toOllamaResponse(payload) {
  const choice = payload?.choices?.[0] || {};
  return {
    model: payload?.model || LLAMA_MODEL,
    created_at: payload?.id || new Date().toISOString(),
    message: {
      role: choice?.message?.role || 'assistant',
      content: choice?.message?.content || '',
    },
    done: true,
    done_reason: choice?.finish_reason || 'stop',
  };
}

function createServer() {
  return http.createServer((req, res) => {
    const url = (req.url || '').split('?')[0];

    if (req.method === 'GET' && url === '/health') {
      const probe = http.get(new URL('/health', LLAMA), (r) => {
        r.resume();
        send(res, r.statusCode === 200 ? 200 : 502, { ok: r.statusCode === 200 });
      });
      probe.on('error', () => send(res, 502, { ok: false, error: 'llama.cpp not running' }));
      probe.setTimeout(3000, () => probe.destroy(new Error('timeout')));
      return;
    }

    if (req.method !== 'POST' || url !== '/api/chat') return send(res, 404, { error: 'not found' });
    if (!authorized(req)) return send(res, 401, { error: 'unauthorized' });

    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        send(res, 413, { error: 'body too large' });
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      if (res.headersSent) return;
      let payload;
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return send(res, 400, { error: 'invalid JSON body' });
      }
      const body = Buffer.from(JSON.stringify(toLlamaRequest(payload)));
      const started = Date.now();
      const upstream = http.request(new URL('/v1/chat/completions', LLAMA), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': body.length },
      }, (upstreamRes) => {
        const responseChunks = [];
        upstreamRes.on('data', (chunk) => responseChunks.push(chunk));
        upstreamRes.on('end', () => {
          let response;
          try {
            response = JSON.parse(Buffer.concat(responseChunks).toString('utf8'));
          } catch {
            return send(res, 502, { error: 'invalid response from llama.cpp' });
          }
          const status = upstreamRes.statusCode || 502;
          send(res, status, status >= 200 && status < 300 ? toOllamaResponse(response) : {
            error: response?.error?.message || response?.error || 'llama.cpp request failed',
          });
          console.log(`[gateway] ${new Date().toLocaleTimeString('th-TH')} /api/chat ${status} ${Date.now() - started}ms`);
        });
      });
      upstream.on('error', (err) => {
        console.error('[gateway] llama.cpp error:', err.message);
        if (!res.headersSent) send(res, 502, { error: 'llama.cpp not running' });
      });
      upstream.end(body);
    });
  });
}

module.exports = { createServer, toLlamaRequest, toOllamaResponse };

if (require.main === module) {
  createServer().listen(PORT, '127.0.0.1', () => {
    console.log(`[gateway] http://127.0.0.1:${PORT} → ${LLAMA.origin} (${LLAMA_MODEL})`);
  });
}
