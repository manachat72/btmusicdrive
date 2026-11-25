import prisma from './prisma';

const MAX_PRODUCT_SLUG_LENGTH = 96;

const WORD_REPLACEMENTS: Array<[RegExp, string]> = [
  [/แฟลชไดรฟ์|แฟลชไดร์ฟ/g, ' flash drive '],
  [/ยูเอสบี|ยูเอส[บป]ี/g, ' usb '],
  [/เอมพีสาม|เอ็มพีสาม/g, ' mp3 '],
  [/รวมเพลง/g, ' ruam phleng '],
  [/เสียงเพลง/g, ' siang phleng '],
  [/เพลงลูกทุ่ง/g, ' phleng luk thung '],
  [/เพลงลูกกรุง/g, ' phleng luk krung '],
  [/เพลงสากล/g, ' phleng sakon '],
  [/เพลงเพื่อชีวิต/g, ' phleng phuea chiwit '],
  [/เพลงสตริง/g, ' phleng string '],
  [/เพลงร็อค/g, ' phleng rock '],
  [/เพลงดัง/g, ' phleng dang '],
  [/เพลงฮิต/g, ' phleng hit '],
  [/เพลงเพราะ/g, ' phleng phro '],
  [/เพลงใต้/g, ' phleng tai '],
  [/บทเพลง/g, ' bot phleng '],
  [/ลูกทุ่ง/g, ' luk thung '],
  [/ลูกกรุง/g, ' luk krung '],
  [/เพื่อชีวิต/g, ' phuea chiwit '],
  [/หมอลำ/g, ' mor lam '],
  [/สตริง/g, ' string '],
  [/สากล/g, ' sakon '],
  [/แดนซ์/g, ' dance '],
  [/ร็อค/g, ' rock '],
  [/รีมิกซ์/g, ' remix '],
  [/คาราโอเกะ/g, ' karaoke '],
  [/รถแห่/g, ' rod hae '],
  [/ในรถยนต์/g, ' nai rot yon '],
  [/ในรถ/g, ' nai rot '],
  [/รถยนต์/g, ' rot yon '],
  [/ธรรมะ/g, ' dhamma '],
  [/บทสวดมนต์|สวดมนต์/g, ' suat mon '],
  [/คาถามงคล/g, ' khatha mongkhon '],
  [/มงคล/g, ' mongkhon '],
  [/คาราบาว/g, ' carabao '],
  [/โลโซ/g, ' loso '],
  [/ลาบานูน/g, ' labanoon '],
  [/พงษ์สิทธิ์/g, ' pongsit '],
  [/พงษ์พัฒน์/g, ' pongpat '],
  [/คำภีร์/g, ' khampee '],
  [/อินดี้/g, ' indy '],
  [/อีสาน/g, ' isan '],
  [/วิทยุ/g, ' radio '],
  [/ย้อนยุค/g, ' yon yuk '],
  [/ตลอดกาล/g, ' tlot kan '],
  [/ในตำนาน/g, ' nai tamnan '],
  [/ตำนาน/g, ' tamnan '],
  [/อมตะ/g, ' amata '],
  [/คุณภาพสูง/g, ' khunaphap sung '],
  [/คุณภาพ/g, ' khunaphap '],
  [/คุณหลงรัก/g, ' khun long rak '],
  [/หลงรัก/g, ' long rak '],
  [/อุปกรณ์เสริม/g, ' accessories '],
  [/ของแถม/g, ' free gift '],
  [/ของฝาก/g, ' khong fak '],
  [/ของขวัญ/g, ' gift '],
  [/หัวแปลง/g, ' adapter '],
  [/พรีเมียม/g, ' premium '],
  [/แฟลช/g, ' flash '],
  [/ไดรฟ์|ไดร์ฟ/g, ' drive '],
  [/เสียงชัด/g, ' siang chat '],
  [/เสียง/g, ' siang '],
  [/ฟังเพลิน/g, ' fang phloen '],
  [/ฟังเพลง/g, ' fang phleng '],
  [/ฟัง/g, ' fang '],
  [/รวมฮิต/g, ' ruam hit '],
  [/รวม/g, ' ruam '],
  [/เพลง/g, ' phleng '],
  [/ยุค/g, ' yuk '],
  [/ฮิต/g, ' hit '],
  [/ดัง/g, ' dang '],
  [/เก่า/g, ' kao '],
  [/ใหม่/g, ' mai '],
  [/รัก/g, ' rak '],
  [/คุณ/g, ' khun '],
  [/ที่/g, ' thi '],
];

// Quote every key as a string literal — Thai combining marks (sara, tone marks)
// can't appear as bare identifiers in TS even though they're valid in object keys.
const THAI_CHAR_MAP: Record<string, string> = {
  'ก': 'k',
  'ข': 'kh',
  'ฃ': 'kh',
  'ค': 'kh',
  'ฅ': 'kh',
  'ฆ': 'kh',
  'ง': 'ng',
  'จ': 'ch',
  'ฉ': 'ch',
  'ช': 'ch',
  'ซ': 's',
  'ฌ': 'ch',
  'ญ': 'y',
  'ฎ': 'd',
  'ฏ': 't',
  'ฐ': 'th',
  'ฑ': 'th',
  'ฒ': 'th',
  'ณ': 'n',
  'ด': 'd',
  'ต': 't',
  'ถ': 'th',
  'ท': 'th',
  'ธ': 'th',
  'น': 'n',
  'บ': 'b',
  'ป': 'p',
  'ผ': 'ph',
  'ฝ': 'f',
  'พ': 'ph',
  'ฟ': 'f',
  'ภ': 'ph',
  'ม': 'm',
  'ย': 'y',
  'ร': 'r',
  'ล': 'l',
  'ว': 'w',
  'ศ': 's',
  'ษ': 's',
  'ส': 's',
  'ห': 'h',
  'ฬ': 'l',
  'อ': 'o',
  'ฮ': 'h',
  'ะ': 'a',
  'ั': 'a',
  'า': 'a',
  'ำ': 'am',
  'ิ': 'i',
  'ี': 'i',
  'ึ': 'ue',
  'ื': 'ue',
  'ุ': 'u',
  'ู': 'u',
  'เ': 'e',
  'แ': 'ae',
  'โ': 'o',
  'ใ': 'ai',
  'ไ': 'ai',
  'ๅ': 'a',
  'ๆ': '',
  '็': '',
  '่': '',
  '้': '',
  '๊': '',
  '๋': '',
  '์': '',
  'ฺ': '',
};

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function transliterateThai(input: string): string {
  let text = input.normalize('NFKC');
  for (const [pattern, replacement] of WORD_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return Array.from(text)
    .map(char => THAI_CHAR_MAP[char] ?? char)
    .join('');
}

export function slugifyProductText(value: unknown): string {
  const text = transliterateThai(toText(value))
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .toLowerCase();

  return text
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, MAX_PRODUCT_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '');
}

function productSlugNeedsRefresh(slug: string | null | undefined): boolean {
  if (!slug) return true;
  return slugifyProductText(slug) !== slug;
}

async function ensureUniqueProductSlug(baseSlug: string, excludeProductId?: string): Promise<string> {
  const cleanBase = (baseSlug || 'product').slice(0, MAX_PRODUCT_SLUG_LENGTH).replace(/^-+|-+$/g, '') || 'product';
  let candidate = cleanBase;
  let suffix = 2;

  while (true) {
    const existing = await prisma.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludeProductId) return candidate;

    const suffixText = `-${suffix}`;
    candidate = `${cleanBase.slice(0, MAX_PRODUCT_SLUG_LENGTH - suffixText.length)}${suffixText}`;
    suffix += 1;
  }
}

export async function resolveProductSlug(
  slugInput: unknown,
  nameInput: unknown,
  skuInput?: unknown,
  excludeProductId?: string,
): Promise<string> {
  const explicitSlug = slugifyProductText(slugInput);
  const baseSlug =
    explicitSlug ||
    slugifyProductText(`${toText(nameInput)} ${toText(skuInput)}`) ||
    slugifyProductText(skuInput) ||
    'product';

  return ensureUniqueProductSlug(baseSlug, excludeProductId);
}

export function shouldRefreshProductSlug(slug: string | null | undefined): boolean {
  return productSlugNeedsRefresh(slug);
}
