import prisma from './prisma';

// ── Shipping config ──────────────────────────────────────────────────────────
// Stored in ShopSetting under key "shipping". Falls back to defaults if the row
// (or the table, before `prisma migrate deploy`) doesn't exist, so checkout
// never breaks because of settings.

export interface ShippingConfig {
  shippingCost: number;          // THB, flat rate
  freeShippingThreshold: number; // THB subtotal; 0 = free shipping disabled
}

export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  shippingCost: 35,
  freeShippingThreshold: 200,
};

const SHIPPING_KEY = 'shipping';
const CACHE_TTL_MS = 60_000;
export const MAX_SHIPPING_COST = 10_000;
export const MAX_FREE_SHIPPING_THRESHOLD = 1_000_000;

let cache: { value: ShippingConfig; expires: number } | null = null;

function isValidAmount(n: unknown, max: number): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
}

export function validateShippingConfig(input: any): ShippingConfig | string {
  const shippingCost = Number(input?.shippingCost);
  const freeShippingThreshold = Number(input?.freeShippingThreshold);
  if (input?.shippingCost === undefined || input?.shippingCost === '' || !isValidAmount(shippingCost, MAX_SHIPPING_COST)) {
    return `ค่าส่งต้องเป็นตัวเลข 0 - ${MAX_SHIPPING_COST}`;
  }
  if (input?.freeShippingThreshold === undefined || input?.freeShippingThreshold === '' || !isValidAmount(freeShippingThreshold, MAX_FREE_SHIPPING_THRESHOLD)) {
    return `ยอดส่งฟรีต้องเป็นตัวเลข 0 - ${MAX_FREE_SHIPPING_THRESHOLD} (0 = ปิดส่งฟรี)`;
  }
  return {
    shippingCost: Math.round(shippingCost * 100) / 100,
    freeShippingThreshold: Math.round(freeShippingThreshold * 100) / 100,
  };
}

export async function getShippingConfig(): Promise<ShippingConfig> {
  if (cache && cache.expires > Date.now()) return cache.value;
  let value = DEFAULT_SHIPPING_CONFIG;
  try {
    const row = await prisma.shopSetting.findUnique({ where: { key: SHIPPING_KEY } });
    if (row) {
      const parsed = validateShippingConfig(JSON.parse(row.value));
      if (typeof parsed !== 'string') value = parsed;
    }
  } catch (err) {
    console.error('[ShopSettings] Failed to load shipping config, using defaults:', err);
  }
  cache = { value, expires: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function saveShippingConfig(config: ShippingConfig): Promise<ShippingConfig> {
  const value = JSON.stringify(config);
  await prisma.shopSetting.upsert({
    where: { key: SHIPPING_KEY },
    create: { key: SHIPPING_KEY, value },
    update: { value },
  });
  cache = { value: config, expires: Date.now() + CACHE_TTL_MS };
  return config;
}

/** Shipping fee for a cart subtotal (before discount), matching storefront display. */
export function calcShippingCost(subtotal: number, cfg: ShippingConfig): number {
  if (subtotal <= 0) return 0;
  const free = cfg.freeShippingThreshold > 0 && subtotal >= cfg.freeShippingThreshold;
  return free ? 0 : cfg.shippingCost;
}
