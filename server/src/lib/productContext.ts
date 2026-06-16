import fs from 'fs';
import path from 'path';

// Strip HTML tags + collapse whitespace from a product description.
function stripHtml(html: string): string {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

interface RawProduct {
  name: string;
  slug: string;
  price: number;
  originalPrice?: number;
  stock?: number;
  description?: string;
  category?: { name?: string };
}

let cached: string | null = null;

/**
 * Build a compact, plain-text catalog summary from products.json that fits
 * comfortably in the model prompt. Cached after first read (cold start only).
 */
export function getProductContext(): string {
  if (cached) return cached;

  // products.json lives at repo root, two levels up from server/src/lib
  const file = path.join(__dirname, '../../../products.json');
  let products: RawProduct[] = [];
  try {
    products = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    console.error('[productContext] failed to read products.json:', err);
    return 'ไม่สามารถโหลดข้อมูลสินค้าได้ในขณะนี้';
  }

  const lines = products.map((p) => {
    const cat = p.category?.name || 'ทั่วไป';
    const price = `${p.price}฿`;
    const stock = (p.stock ?? 0) > 0 ? 'มีสินค้า' : 'สินค้าหมด';
    const desc = stripHtml(p.description || '').slice(0, 120);
    return `- ${p.name} | หมวด: ${cat} | ราคา: ${price} | ${stock} | ลิงก์: btmusicdrive.com/product/${p.slug}${desc ? ` | ${desc}` : ''}`;
  });

  cached = lines.join('\n');
  return cached;
}
