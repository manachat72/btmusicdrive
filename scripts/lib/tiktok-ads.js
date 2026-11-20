// TikTok Marketing API (Business API v1.3) — shared helpers for
// scripts/tiktok-ads-auth.js and scripts/tiktok-ads-report.js.
// Credentials live in server/.env.local only (gitignored) — never in source: this repo is public.
const fs = require('fs');
const path = require('path');

const API = 'https://business-api.tiktok.com/open_api/v1.3';
const ENV_LOCAL = path.join(__dirname, '..', '..', 'server', '.env.local');
const REDIRECT_URI = 'https://btmusicdrive.com/api/tiktok/callback';

// .env.local first, then .env — first file wins because we never overwrite a set value
function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(__dirname, '..', '..', 'server', f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  }
}

// Set or replace KEY=value lines in server/.env.local, keeping every other line as is
function saveEnvLocal(values) {
  let lines = fs.existsSync(ENV_LOCAL) ? fs.readFileSync(ENV_LOCAL, 'utf8').split(/\r?\n/) : [];
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}="${value}"`;
    const i = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (i >= 0) lines[i] = line;
    else {
      while (lines.length && lines[lines.length - 1] === '') lines.pop();
      lines.push(line);
    }
    process.env[key] = value;
  }
  fs.writeFileSync(ENV_LOCAL, lines.join('\n').replace(/\n*$/, '\n'));
}

function requireEnv(...keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`ยังไม่ได้ตั้ง ${missing.join(', ')} ใน server/.env.local`);
  }
}

async function call(method, endpoint, { token, query, body } = {}) {
  const url = new URL(API + endpoint);
  for (const [k, v] of Object.entries(query || {})) {
    url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'Access-Token': token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!json) throw new Error(`TikTok API ${endpoint}: HTTP ${res.status} (ไม่ใช่ JSON)`);
  if (json.code !== 0) {
    const err = new Error(`TikTok API ${endpoint}: [${json.code}] ${json.message}`);
    err.code = json.code;
    throw err;
  }
  return json.data;
}

module.exports = { API, ENV_LOCAL, REDIRECT_URI, loadEnv, saveEnvLocal, requireEnv, call };
