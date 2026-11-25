/**
 * ai-artist-spawn — helper เรียก claude CLI แบบ subprocess (Max quota)
 *
 * - Windows cmd encoding: spawn via cmd /c + stdin pipe เพื่อเลี่ยงปัญหา encoding ตอนส่ง prompt ภาษาไทย
 * - Unknown-artist detection → mark unknown:true so we don't spam
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadArtists, saveArtist, validateEntry, normalizeKey } = require('./artists');

const MODEL = 'claude-sonnet-5';
const TIMEOUT = 150_000; // 150s ต่อชื่อ — ต้องเผื่อเวลา WebSearch
const TMP = path.join(__dirname, '..', 'tmp');

// persona ของ agent — ส่งเข้า claude CLI ผ่าน --append-system-prompt
const SYSTEM = 'คุณคือผู้ช่วยวิจัยคีย์เวิร์ดตลาดคอนเทนต์เสียงไทย (เพลง ธรรมะ เรื่องเล่า นิยายเสียง) '
  + 'ต้องใช้ WebSearch ค้นหาก่อนตอบเสมอ ห้ามตอบจากความจำล้วน '
  + 'ตอบเป็น JSON ล้วนเท่านั้น ห้ามมีข้อความอื่น ห้ามใส่ markdown fence '
  + 'ใส่ "unknown": true ได้ต่อเมื่อค้นเว็บแล้วยังไม่เจอข้อมูลจริง ๆ ห้ามเดามั่ว';

function promptFor(name) {
  return `Thai artist / content creator: "${name}"

Reply with ONE JSON object only — no prose, no markdown fence. Fields:
{"artist":"...","unknown":false,"type":"...","contentType":"...","genre":"...","aliases":[...],"keywords":[...],"hook":"...","notes":"..."}

Rules:
- ค้นเว็บก่อนเสมอ (WebSearch) อย่างน้อย 1 ครั้ง แม้จะคิดว่ารู้จักแล้ว — ต้องยืนยันว่าเป็นใคร ทำคอนเทนต์แบบไหน
- ตอบ "unknown":true ได้เฉพาะกรณีค้นแล้วไม่เจอข้อมูลจริง ๆ เท่านั้น
- "type" คือประเภทคนทำคอนเทนต์ เช่น นักร้องลูกทุ่ง / วงดนตรี / นักเล่าเรื่อง / พระนักเทศน์ / นักจัดรายการ
- "contentType" ต้องเป็นหนึ่งใน: เพลง / เรื่องเล่า / ธรรมะ / นิยายเสียง / รายการวิทยุ
  (คนที่ไม่ได้ร้องเพลง เช่น นักเล่าเรื่องผี พระนักเทศน์ ห้ามใส่ "เพลง")
- "genre" must be one of: เพลงฮิต / เพื่อชีวิต / ลูกทุ่ง / ลูกกรุง / เพลงใต้ / ร็อคไทย / สากล / แดนซ์ / ธรรมะ / วิทยุ / อุปกรณ์เสริม / สตริง
- "keywords" >=3 items -- phrases Thai people actually type when searching
- "hook" <=90 chars -- a sales sentence, not a heading
- "aliases" -- nicknames / alternative spellings
- "notes" <=120 chars -- the target listeners

JSON only.`;
}

function researchOne(name) {
  const r = spawnSync('cmd', [
    '/c', 'claude',
    '--print',
    '--model', MODEL,
    '--output-format', 'json',
    '--max-turns', '8',
    '--permission-mode', 'acceptEdits',
    '--allowedTools', 'WebSearch,WebFetch',
    '--append-system-prompt', SYSTEM,
  ], {
    cwd: TMP,
    timeout: TIMEOUT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    input: promptFor(name),
    shell: false,
  });
  if (r.error) throw new Error(r.error.message);
  if (r.status !== 0) throw new Error(`exit ${r.status}: ${(r.stderr || '').slice(0, 200)}`);
  let outer;
  try { outer = JSON.parse(r.stdout); } catch { throw new Error('stdout not JSON'); }
  const text = outer.result || outer.message || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no JSON in result');
  return JSON.parse(m[0]);
}

/**
 * research artists in order, skip cached, save valid entries
 * @returns {object} { researched: [{artist, unknown, keywords...}], errors: [string], skipped: [string] }
 */
function researchArtists(names, { force = false } = {}) {
  fs.mkdirSync(TMP, { recursive: true });
  const cache = loadArtists({ fresh: true });
  const out = { ok: [], errors: [], skipped: [] };
  for (const raw of names) {
    const n = String(raw || '').trim();
    if (!n) continue;
    const key = normalizeKey(n);
    if (cache[key] && !force) { out.skipped.push(n); continue; }
    try {
      const e = researchOne(n);
      const errs = validateEntry(e);
      if (errs.length) { out.errors.push(`${n}: ${errs.join(' · ')}`); continue; }
      saveArtist(n, e);
      out.ok.push({ artist: n, unknown: e.unknown === true, cacheHit: false });
      cache[key] = e; // refresh in-memory
    } catch (err) {
      out.errors.push(`${n}: ${err.message.slice(0, 200)}`);
    }
  }
  return out;
}

module.exports = { researchArtists, researchOne, promptFor };
