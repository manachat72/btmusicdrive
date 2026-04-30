const THAI_COMBINING_MARKS = /[\u0e31\u0e34-\u0e3a\u0e47-\u0e4e]/;

export function normalizeCategoryName(value: unknown): string {
  const input = String(value || '')
    .normalize('NFC')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  let out = '';
  let marksInCluster = new Set<string>();

  for (const ch of input) {
    if (!THAI_COMBINING_MARKS.test(ch)) {
      marksInCluster = new Set();
      out += ch;
      continue;
    }
    if (marksInCluster.has(ch)) continue;
    marksInCluster.add(ch);
    out += ch;
  }

  return out.normalize('NFC');
}

export function categoryNameKey(value: unknown): string {
  return normalizeCategoryName(value).toLocaleLowerCase('th-TH');
}
