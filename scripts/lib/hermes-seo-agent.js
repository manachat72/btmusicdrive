'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const BANNED_UNVERIFIED_CLAIMS = /320\s?kbps|ทุกรุ่น|ภายใน\s*7\s*วัน|ส่งไว/iu;
const ACCESSORY_AUDIO_WORDS = /แฟลชไดรฟ์|\bMP3\b|รวมเพลง|ฟังในรถ/iu;
const DUPLICATE_WORDS = /รวมเพลงรวมเพลง|เพลงเพลง|เรื่องเล่าเรื่องเล่า|ธรรมะธรรมะ/iu;

function buildPrompt(input) {
  const facts = {
    shortName: String(input.shortName || '').trim(),
    categoryName: String(input.categoryName || '').trim(),
    capacity: String(input.capacity || '').trim(),
    price: Number(input.price) || null,
    contentType: input.contentType === 'accessory' ? 'accessory' : 'audio',
    tracklistCount: Array.isArray(input.tracklist) ? input.tracklist.length : 0,
    artists: Array.isArray(input.artists) ? input.artists.slice(0, 6) : [],
  };

  return [
    'You are the senior Thai ecommerce SEO editor for Bt Music Drive.',
    'Create a factual Thai SEO draft from ONLY the verified facts below.',
    'Return one JSON object only, with no markdown or explanation:',
    '{"name":"...","metaTitle":"...","metaDescription":"...","tags":["..."]}',
    '',
    'Rules:',
    '- Do not invent song counts, artists, technical specifications, delivery promises, compatibility, bitrate, reviews, discounts, or guarantees.',
    '- metaTitle must be 60 characters or fewer including " | Bt Music Drive".',
    '- metaDescription must be 155 characters or fewer.',
    '- Never duplicate phrases such as "รวมเพลงรวมเพลง" or "เพลงเพลง".',
    '- For contentType "accessory", never call it a USB music drive, MP3 product, song collection, or car-listening product.',
    '- For contentType "audio", both name and metaTitle must explicitly include "USB" or "แฟลชไดรฟ์" so the product type is clear.',
    '- Use customer-search wording naturally; avoid keyword stuffing.',
    '- Tags must be 4–10 factual Thai search phrases.',
    '- ห้ามแต่งข้อมูลที่ไม่อยู่ใน facts.',
    '',
    `facts: ${JSON.stringify(facts)}`,
  ].join('\n');
}

function extractJson(raw) {
  const text = String(raw || '').trim();
  try { return JSON.parse(text); } catch { }
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Hermes Agent did not return JSON');
  try { return JSON.parse(match[0]); } catch { throw new Error('Hermes Agent returned invalid JSON'); }
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseAndValidateDraft(raw, input) {
  const parsed = typeof raw === 'string' ? extractJson(raw) : raw;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Hermes SEO draft must be an object');

  const draft = {
    name: cleanText(parsed.name),
    metaTitle: cleanText(parsed.metaTitle),
    metaDescription: cleanText(parsed.metaDescription),
    tags: Array.isArray(parsed.tags) ? [...new Set(parsed.tags.map(cleanText).filter(Boolean))] : [],
  };

  if (!draft.name || !draft.metaTitle || !draft.metaDescription || draft.tags.length < 4) {
    throw new Error('Hermes SEO draft is missing required fields');
  }
  if (draft.metaTitle.length > 60) throw new Error('Meta title exceeds 60 characters');
  if (draft.metaDescription.length > 155) throw new Error('Meta description exceeds 155 characters');
  if (draft.tags.length > 10) throw new Error('Hermes SEO draft has too many tags');
  if (DUPLICATE_WORDS.test(`${draft.name} ${draft.metaTitle}`)) throw new Error('Hermes SEO draft contains duplicate words');
  if (BANNED_UNVERIFIED_CLAIMS.test(`${draft.name} ${draft.metaTitle} ${draft.metaDescription}`)) {
    throw new Error('Hermes SEO draft contains an unverified claim');
  }

  if (input.contentType === 'accessory') {
    if (ACCESSORY_AUDIO_WORDS.test(`${draft.name} ${draft.metaTitle} ${draft.metaDescription}`)) {
      throw new Error('อุปกรณ์เสริมต้องไม่ถูกเขียนเป็นสินค้าเพลง');
    }
  } else if (!/USB|แฟลชไดรฟ์/iu.test(`${draft.name} ${draft.metaTitle}`)) {
    throw new Error('SEO draft for audio products must include USB or แฟลชไดรฟ์');
  }

  return draft;
}

function runHermesSeo(input) {
  const promptFile = path.join(os.tmpdir(), `btmusic-hermes-seo-${process.pid}-${Date.now()}.txt`);
  try {
    fs.writeFileSync(promptFile, buildPrompt(input), 'utf8');
    const result = spawnSync('hermes', [
      'chat', '--query-file', promptFile, '--quiet', '--source', 'tool',
      '--max-turns', '0', '--run-budget', '120', '--in', ROOT,
    ], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 130_000,
      shell: false,
    });
    if (result.error) throw new Error(`Hermes Agent failed: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`Hermes Agent failed: ${(result.stderr || result.stdout || '').trim().slice(0, 300)}`);
    return parseAndValidateDraft(result.stdout, input);
  } finally {
    try { fs.unlinkSync(promptFile); } catch { }
  }
}

module.exports = { buildPrompt, parseAndValidateDraft, runHermesSeo };
