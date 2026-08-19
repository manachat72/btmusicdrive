/**
 * artists cache — "วัตถุดิบ" SEO รายศิลปิน ที่ subagent `seo-artist-research` วิจัยไว้
 *
 * ทำไมต้องมี: extractArtists() ใน seo.js ดึงได้แค่ "ชื่อ" จาก tracklist
 * แต่ไม่รู้ว่าเป็นใคร แนวอะไร คนไทยพิมพ์ค้นว่าอะไร → cache นี้เติมส่วนนั้น
 *
 * หน้าที่ของไฟล์นี้คือ "อ่าน + เขียน cache" เท่านั้น
 * การประกอบชื่อ/description/meta ยังเป็นของ buildSeo() ใน seo.js เหมือนเดิม
 *
 * ไฟล์ cache: scripts/data/artists.json  (key = normalizeKey(ชื่อที่พิมพ์))
 * entry ที่ unknown:true = วิจัยแล้วแต่ไม่รู้จัก → ถือว่าไม่มีข้อมูล อย่ายิงซ้ำ
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'artists.json');

/** normalize ชื่อให้เป็น cache key — ตัดช่องว่างทั้งหมด + lowercase + ตัดจุด/ขีดท้าย */
function normalizeKey(name) {
  return String(name || '')
    .normalize('NFC')
    .replace(/[\s ]+/g, '')
    .replace(/[.\-–—_"'`]+$/g, '')
    .toLowerCase();
}

let _cache = null;

/** โหลดทั้งไฟล์ (memoized ต่อ process — studio เป็น long-running server) */
function loadArtists({ fresh = false } = {}) {
  if (_cache && !fresh) return _cache;
  try {
    _cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    _cache = {};
  }
  return _cache;
}

/**
 * ดึงข้อมูลศิลปิน 1 คน
 * @returns {object|null} null = ยังไม่เคยวิจัย หรือ วิจัยแล้วได้ unknown:true
 */
function getArtist(name) {
  const hit = loadArtists()[normalizeKey(name)];
  if (!hit || hit.unknown === true) return null;
  return hit;
}

/** เคยวิจัยชื่อนี้ไปแล้วหรือยัง (รวมเคสที่ผลลัพธ์เป็น unknown) */
function isResearched(name) {
  return Object.prototype.hasOwnProperty.call(loadArtists(), normalizeKey(name));
}

/**
 * รวมวัตถุดิบจากศิลปินหลายคน สำหรับป้อน buildSeo()
 * @param {string[]} names ชื่อที่ extractArtists() ดึงมา
 * @returns {{keywords:string[], aliases:string[], genres:string[], contentTypes:string[], hooks:string[], known:string[], missing:string[]}}
 */
function collect(names = []) {
  const keywords = [], aliases = [], genres = [], hooks = [], known = [], missing = [], contentTypes = [];
  for (const n of names) {
    const a = getArtist(n);
    if (!a) {
      if (!isResearched(n)) missing.push(n);
      continue;
    }
    known.push(n);
    if (Array.isArray(a.keywords)) keywords.push(...a.keywords);
    if (Array.isArray(a.aliases)) aliases.push(...a.aliases);
    if (a.genre) genres.push(a.genre);
    if (a.contentType) contentTypes.push(a.contentType);
    if (a.hook) hooks.push(a.hook);
  }
  const uniq = arr => [...new Set(arr.map(s => String(s).trim()).filter(Boolean))];
  return {
    keywords: uniq(keywords),
    aliases: uniq(aliases),
    genres: uniq(genres),
    contentTypes: uniq(contentTypes),
    hooks: uniq(hooks),
    known,
    missing: uniq(missing),
  };
}

const REQUIRED = ['artist', 'unknown', 'type', 'genre', 'aliases', 'keywords', 'hook', 'notes'];

/** ตรวจ JSON ที่ subagent คืนมา ก่อนเขียนลง cache */
function validateEntry(e) {
  const errs = [];
  if (!e || typeof e !== 'object') return ['ไม่ใช่ object'];
  for (const k of REQUIRED) if (!(k in e)) errs.push(`ขาดฟิลด์ ${k}`);
  if (typeof e.unknown !== 'boolean') errs.push('unknown ต้องเป็น boolean');
  if (e.unknown === false) {
    if (!Array.isArray(e.keywords) || e.keywords.length < 3) errs.push('keywords ต้องมีอย่างน้อย 3 คำ');
    if (!e.hook) errs.push('hook ว่าง');
  }
  if (e.hook && e.hook.length > 90) errs.push(`hook ยาว ${e.hook.length} ตัว (≤90)`);
  if (e.notes && e.notes.length > 120) errs.push(`notes ยาว ${e.notes.length} ตัว (≤120)`);
  return errs;
}

/**
 * เขียน entry ลง cache (merge ไม่ทับทั้งไฟล์) — เรียงคีย์ตามตัวอักษร
 * @param {string} name ชื่อที่พิมพ์
 * @param {object} entry ผลจาก subagent
 */
function saveArtist(name, entry) {
  const errs = validateEntry(entry);
  if (errs.length) throw new Error(`entry ไม่ผ่าน: ${errs.join(' · ')}`);
  const all = loadArtists({ fresh: true });
  all[normalizeKey(name)] = {
    ...entry,
    artist: entry.artist || name,
    researchedAt: entry.researchedAt || new Date().toISOString().slice(0, 10),
  };
  const sorted = {};
  for (const k of Object.keys(all).sort()) sorted[k] = all[k];
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  _cache = sorted;
  return sorted[normalizeKey(name)];
}

module.exports = {
  FILE, normalizeKey, loadArtists, getArtist, isResearched,
  collect, validateEntry, saveArtist,
};
