// Extra-song-pack validation + Stripe metadata chunking.
// Kept dependency-free (no prisma/stripe imports) so it can be unit-tested
// by requiring the compiled file directly, no app bootstrap needed.

// YouTube video id: 11 chars of [A-Za-z0-9_-]
export const YOUTUBE_ID_RE = /^[\w-]{11}$/;

// Hard cap on the serialized extraSongs JSON before it's even parsed.
const MAX_EXTRA_SONGS_LEN = 4000;

// Stripe metadata values are capped at 500 chars; leave margin.
const STRIPE_METADATA_VALUE_LEN = 450;

/**
 * Validates a cart against the song-pack business rules and returns the
 * canonical JSON string to persist (or null if there's nothing to store).
 * Throws Error with a Thai message (caller maps '...เพลงพิเศษ...' to a 400).
 *
 * cart: { items: [{ quantity, product: { specs: { songPack?: number } } }] }
 * rawExtraSongs: expected shape once parsed: { [usbProductId]: string[] } where
 * each string is an 11-char YouTube video id.
 */
export function validateSongPacks(cart: any, rawExtraSongs: unknown): string | null {
  const packItems = cart.items.filter((i: any) => (i.product.specs as any)?.songPack);
  const nonPackItems = cart.items.filter((i: any) => !(i.product.specs as any)?.songPack);

  if (packItems.length > 0 && nonPackItems.length === 0) {
    throw new Error('ไม่สามารถสั่งซื้อแพ็กเพลงพิเศษเพียงอย่างเดียวได้ ต้องมีสินค้าหลักในตะกร้าด้วย');
  }
  if (packItems.length === 0 || rawExtraSongs == null || rawExtraSongs === '') return null;

  const raw = typeof rawExtraSongs === 'string' ? rawExtraSongs : JSON.stringify(rawExtraSongs);
  if (raw.length > MAX_EXTRA_SONGS_LEN) {
    throw new Error('รายชื่อเพลงพิเศษยาวเกินไป');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('รูปแบบรายชื่อเพลงพิเศษไม่ถูกต้อง');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('รูปแบบรายชื่อเพลงพิเศษไม่ถูกต้อง');
  }

  const groups = parsed as Record<string, unknown>;
  let totalSongs = 0;
  for (const songs of Object.values(groups)) {
    if (!Array.isArray(songs)) {
      throw new Error('รูปแบบรายชื่อเพลงพิเศษไม่ถูกต้อง');
    }
    for (const song of songs) {
      if (typeof song !== 'string' || !YOUTUBE_ID_RE.test(song)) {
        throw new Error('รูปแบบรหัสเพลงพิเศษไม่ถูกต้อง');
      }
    }
    totalSongs += songs.length;
  }

  const maxSongs = packItems.reduce(
    (sum: number, i: any) => sum + (i.product.specs as any).songPack * i.quantity,
    0
  );
  if (totalSongs > maxSongs) {
    throw new Error(`จำนวนเพลงพิเศษ (${totalSongs}) เกินจำนวนที่ซื้อ (${maxSongs})`);
  }

  return JSON.stringify(groups);
}

/** Splits a validated extraSongs JSON string into Stripe-metadata-sized chunks. */
export function chunkExtraSongsForMetadata(extraSongs: string | null | undefined): Record<string, string> {
  if (!extraSongs) return {};
  const chunks: Record<string, string> = {};
  for (let i = 0; i * STRIPE_METADATA_VALUE_LEN < extraSongs.length; i++) {
    chunks[`extraSongs_${i}`] = extraSongs.slice(
      i * STRIPE_METADATA_VALUE_LEN,
      (i + 1) * STRIPE_METADATA_VALUE_LEN
    );
  }
  return chunks;
}

/** Reassembles extraSongs from Stripe metadata chunks (extraSongs_0, extraSongs_1, ...). */
export function unchunkExtraSongsFromMetadata(metadata: Record<string, string | undefined> | null | undefined): string | null {
  if (!metadata) return null;
  const parts: string[] = [];
  for (let i = 0; metadata[`extraSongs_${i}`] != null; i++) {
    parts.push(metadata[`extraSongs_${i}`] as string);
  }
  if (parts.length > 0) return parts.join('');
  return metadata.extraSongs || null; // legacy single-key PaymentIntents created before chunking
}
