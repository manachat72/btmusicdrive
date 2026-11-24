/**
 * test-song-packs.mjs — node:assert checks for server/src/lib/songPacks.ts
 * No test runner installed; run against the compiled dist output:
 *   npm run build && node scripts/test-song-packs.mjs
 */
import assert from 'node:assert';
import { validateSongPacks, chunkExtraSongsForMetadata, unchunkExtraSongsFromMetadata } from '../dist/lib/songPacks.js';

const usb = (id) => ({ productId: id, quantity: 1, product: { specs: {} } });
const pack10 = { productId: 'song-pack-10', quantity: 1, product: { specs: { songPack: 10 } } };
const pack20 = { productId: 'song-pack-20', quantity: 1, product: { specs: { songPack: 20 } } };
const ytId = (n) => String(n).padStart(11, '0').slice(0, 11).replace(/^0/, 'a'); // 11-char fake id

// 1. pack alone -> rejected
assert.throws(
  () => validateSongPacks({ items: [pack10] }, null),
  /เพลงพิเศษเพียงอย่างเดียว/,
  'pack alone should be rejected'
);

// 2. song count over what was bought -> rejected
{
  const cart = { items: [usb('usb1'), pack10] };
  const over = JSON.stringify({ usb1: Array.from({ length: 11 }, (_, i) => ytId(i)) });
  assert.throws(() => validateSongPacks(cart, over), /เกินจำนวนที่ซื้อ/, 'over-quota songs should be rejected');
}

// 3. USB x2, 20 valid YouTube ids each (~640 chars) -> must pass AND chunk/unchunk round-trip
{
  const cart = { items: [usb('usbA'), usb('usbB'), pack20, pack20] }; // 2x pack20 = 40 song quota
  const songsA = Array.from({ length: 20 }, (_, i) => ytId(i));
  const songsB = Array.from({ length: 20 }, (_, i) => ytId(i + 100));
  const payload = { usbA: songsA, usbB: songsB };
  const raw = JSON.stringify(payload);
  assert.ok(raw.length > 450, `test payload should exceed one Stripe metadata value (got ${raw.length})`);

  const stored = validateSongPacks(cart, payload);
  assert.strictEqual(stored, JSON.stringify(payload), 'valid multi-USB payload should pass unchanged');

  const chunks = chunkExtraSongsForMetadata(stored);
  assert.ok(Object.keys(chunks).length > 1, 'payload over 450 chars must be split into multiple metadata keys');
  for (const v of Object.values(chunks)) assert.ok(v.length <= 450, 'each chunk must fit a Stripe metadata value');

  const rebuilt = unchunkExtraSongsFromMetadata(chunks);
  assert.strictEqual(rebuilt, stored, 'unchunk must reconstruct the exact original string');

  // and it must still validate fine once reconstructed (as confirm-order/webhook do)
  const revalidated = validateSongPacks(cart, rebuilt);
  assert.strictEqual(revalidated, stored);
}

// 4. malformed extraSongs -> 400-style Error, not a crash
{
  const cart = { items: [usb('usb1'), pack10] };
  for (const bad of ['null', '[1]', '"just a string"', '{"usb1":"not-an-array"}', '{"usb1":["too-short"]}']) {
    assert.throws(() => validateSongPacks(cart, bad), Error, `malformed input should throw cleanly: ${bad}`);
  }
}

console.log('ALL ASSERTIONS PASSED (4/4 cases)');
