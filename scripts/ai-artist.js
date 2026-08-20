#!/usr/bin/env node
/**
 * ai-artist — วิจัยศิลปินแล้วเซฟลง scripts/data/artists.json
 * ใช้ claude CLI (Max) → ไม่เสียเงินเพิ่ม, ไม่ใช่ Anthropic API ตรง
 *
 * Windows encoding gotcha: `cmd /c claude` resolves to claude.cmd on PATH,
 * and feeding the prompt via stdin (not argv) avoids cmd ANSI mangling
 * of UTF-8 Thai characters.
 *
 * Usage:
 *   node scripts/ai-artist.js <name> [<name> ...]
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadArtists, saveArtist, validateEntry, normalizeKey } = require('./lib/artists');

const MODEL = 'claude-sonnet-5';
const TIMEOUT = 90_000;
const TMP = path.join(__dirname, 'tmp');

function promptFor(name) {
  return `Thai artist: "${name}"

Reply with ONE JSON object only — no prose, no markdown fence. Fields:
{"artist":"...","unknown":false,"type":"...","genre":"...","aliases":[...],"keywords":[...],"hook":"...","notes":"..."}

Rules:
- If you do not know them, or are not sure of them → "unknown":true and all other fields empty
- "genre" must be one of: เพลงฮิต / เพื่อชีวิต / ลูกทุ่ง / ลูกกรุง / เพลงใต้ / ร็อคไทย / สากล / แดนซ์ / ธรรมะ / วิทยุ / อุปกรณ์เสริม / สตริง
- "keywords" ≥3 items — phrases Thai people actually type when searching
- "hook" ≤90 chars — a sales sentence, not a heading
- "aliases" — nicknames / alternative spellings
- "notes" ≤120 chars — the target listeners

JSON only.`;
}

function research(name) {
  fs.mkdirSync(TMP, { recursive: true });
  // cmd /c resolves claude.cmd on PATH; feeding stdin over pipe avoids cmd ANSI mangling of UTF-8 Thai text
  const r = spawnSync('cmd', [
    '/c', 'claude',
    '--print',
    '--model', MODEL,
    '--output-format', 'json',
    '--max-turns', '4',
    '--permission-mode', 'acceptEdits',
  ], {
    cwd: TMP,
    timeout: TIMEOUT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    input: promptFor(name),
  });
  if (r.error) throw new Error(r.error.message);
  if (r.status !== 0) throw new Error(`exit ${r.status}: ${(r.stderr || '').slice(0, 180)}`);
  let outer;
  try { outer = JSON.parse(r.stdout); } catch { throw new Error('stdout not JSON: ' + r.stdout.slice(0, 180)); }
  const text = outer.result || outer.message || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no JSON in result');
  return JSON.parse(m[0]);
}

function main() {
  const names = process.argv.slice(2);
  if (!names.length) { console.log('usage: node scripts/ai-artist.js <name> [<name> ...]'); return; }

  const cache = loadArtists({ fresh: true });
  let okCount = 0;
  for (const n of names) {
    const key = normalizeKey(n);
    if (cache[key]) { console.log(`· cached  ${n}`); continue; }
    try {
      console.log(`· research ${n} …`);
      const e = research(n);
      const errs = validateEntry(e);
      if (errs.length) { console.error(`  ⚠ validate fail: ${errs.join(' · ')}`); continue; }
      saveArtist(n, e);
      okCount++;
      console.log(`  ✓ saved ${e.artist || n}${e.unknown ? ' (unknown)' : ''}`);
    } catch (err) {
      console.error(`  ✗ ${n}: ${err.message.slice(0, 200)}`);
    }
  }
  console.log(`\nsaved ${okCount}/${names.length}`);
}
main();
