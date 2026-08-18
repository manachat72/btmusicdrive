/**
 * SEO engine สำหรับสินค้า btmusicdrive
 *
 * สร้างจากข้อมูลดิบ (ชื่อสั้น + รายชื่อเพลง + ความจุ + ราคา) ให้ครบชุด:
 *   name · description · metaTitle · metaDescription · tags · categoryName · specs
 * พร้อม validate ความยาว/คีย์เวิร์ด/ความซ้ำ ก่อนลงจริง
 *
 * หลักที่ยึด:
 *   - ชื่อสินค้า: คีย์เวิร์ดหลักมาก่อน ("USB แฟลชไดรฟ์ MP3 รวมเพลง<หมวด>")
 *   - 155 ตัวอักษรแรกของ description = meta description จริงบน Google
 *     (inline-product-jsonld.js ตัดตรงนี้) → ต้องเป็นประโยคขาย ไม่ใช่หัวข้อ
 *   - ศิลปินจากรายชื่อเพลง = long-tail keyword ที่คนค้นจริง
 */
const { slugify, imageSlug } = require('./product-slug');

const GENRES = [
  { re: /เพื่อชีวิต|คาราบาว|พงษ์สิทธิ์|คำภีร์|มาลีฮวนน่า|พงษ์เทพ/, name: 'เพื่อชีวิต', cat: 'เพื่อชีวิต',
    kw: ['เพลงเพื่อชีวิต', 'เพลงเพื่อชีวิตเก่า', 'เพลงเพื่อชีวิตในตำนาน', 'รวมเพลงเพื่อชีวิต'] },
  { re: /ลูกทุ่ง|หมอลำ|อีสาน|พุ่มพวง|ครูสลา|รถแห่/, name: 'ลูกทุ่ง', cat: 'ลูกทุ่ง',
    kw: ['เพลงลูกทุ่ง', 'ลูกทุ่งเก่า', 'ลูกทุ่งฮิต', 'รวมเพลงลูกทุ่ง'] },
  { re: /ลูกกรุง|สุนทราภรณ์|อมตะ/, name: 'ลูกกรุง', cat: 'ลูกกรุง',
    kw: ['เพลงลูกกรุง', 'เพลงเก่าอมตะ', 'เพลงอมตะ', 'เพลงเก่าในตำนาน'] },
  { re: /ใต้|สตอ|สำเนียงใต้/, name: 'เพลงใต้', cat: 'เพลงใต้',
    kw: ['เพลงใต้', 'เพลงใต้เก่า', 'สำเนียงใต้', 'เพลงใต้ฮิต'] },
  { re: /ร็อค|โลโซ|bodyslam|ลาบานูน|บิ๊กแอส|clash/i, name: 'ร็อคไทย', cat: 'เพลงสตริง',
    kw: ['เพลงร็อค', 'ร็อคไทย', 'ร็อคยุค 90', 'เพลงร็อคเก่า'] },
  { re: /สากล|international|oldies|disco/i, name: 'สากล', cat: 'เพลงสากล',
    kw: ['เพลงสากล', 'เพลงสากลเก่า', 'เพลงฮิตสากล', 'เพลงสากลยุค 80'] },
  { re: /แดนซ์|dance|3 ?ช่า|สามช่า|มันส์|รีมิกซ์|remix/i, name: 'แดนซ์', cat: 'แดนซ์',
    kw: ['เพลงแดนซ์', 'เพลงมันส์', 'เพลงปาร์ตี้', 'เพลง 3 ช่า'] },
  { re: /ธรรมะ|สวดมนต์|คาถา|นิยายเสียง|พระ/, name: 'ธรรมะ', cat: 'ธรรมะ',
    kw: ['ธรรมะ', 'เสียงสวดมนต์', 'ฟังธรรมะ', 'บทสวดมนต์'] },
  { re: /วิทยุ|radio/i, name: 'วิทยุ', cat: 'วิทยุ',
    kw: ['วิทยุพกพา', 'วิทยุ FM', 'วิทยุเสียบ USB', 'วิทยุพร้อมเพลง'] },
  { re: /otg|หัวแปลง|adapter|สายแปลง/i, name: 'อุปกรณ์เสริม', cat: 'อุปกรณ์เสริม',
    kw: ['อุปกรณ์เสริม', 'OTG', 'หัวแปลง USB', 'อะแดปเตอร์'] },
  { re: /สตริง|ยุค ?90|ยุค ?80|ยุค ?2000|tiktok|ฮิต|เพราะ/i, name: 'สตริง', cat: 'เพลงสตริง',
    kw: ['เพลงสตริง', 'เพลงเก่า', 'เพลงฮิตยุค 90', 'เพลงเพราะ'] },
];

const CATEGORIES = ['เพื่อชีวิต', 'เพลงสตริง', 'เพลงใต้', 'เพลงสากล', 'ลูกกรุง', 'ลูกทุ่ง', 'อุปกรณ์เสริม', 'แดนซ์', 'วิทยุ', 'ธรรมะ'];

/** คีย์เวิร์ดฐานที่ทุกสินค้าควรมี (คนค้นจริงบน Google/Shopee) */
const BASE_KW = ['แฟลชไดรฟ์เพลง', 'USB เพลง', 'เพลงในรถ', 'MP3 ฟังในรถ'];

const STOP_WORDS = /^(feat|ft|official|mv|audio|lyrics|karaoke|cover|remix|version|hd|mp3|new|the|and|vol|ost)$/i;

function detectGenre(text) {
  return GENRES.find(g => g.re.test(String(text || ''))) ||
    { name: 'เพลงฮิต', cat: 'เพลงสตริง', kw: ['เพลงฮิต', 'รวมเพลง', 'เพลงเพราะ', 'เพลงเก่า'] };
}

/**
 * ดึงชื่อศิลปินจากรายชื่อเพลง — รองรับรูปแบบ
 *   "01. ชื่อเพลง - ศิลปิน" · "ศิลปิน - ชื่อเพลง" · "ชื่อเพลง (ศิลปิน)"
 * คืนศิลปินที่โผล่ ≥2 ครั้ง เรียงตามความถี่ (คนค้นชื่อศิลปินมากกว่าชื่อสินค้า)
 */
function extractArtists(tracklist, limit = 6) {
  const count = new Map();
  for (const raw of tracklist || []) {
    const line = String(raw).replace(/^\s*\d+[\.\)\-]\s*/, '').trim();
    if (!line) continue;
    const parts = line.split(/\s+[-–—]\s+/);
    const paren = line.match(/[\(（]([^)）]{2,40})[\)）]\s*$/);
    const cands = [];
    if (parts.length >= 2) { cands.push(parts[parts.length - 1], parts[0]); }
    if (paren) cands.push(paren[1]);
    for (const c of cands) {
      const name = c.trim().replace(/[\.\-–—_"']+$/, '').trim();
      if (name.length < 2 || name.length > 30) continue;
      if (STOP_WORDS.test(name)) continue;
      if (/^\d+$/.test(name)) continue;
      count.set(name, (count.get(name) || 0) + 1);
    }
  }
  return [...count.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([n]) => n);
}

function clean(s) { return String(s || '').replace(/\s{2,}/g, ' ').trim(); }

/** ตัดข้อความที่ขอบคำ ไม่ตัดกลางคำจนอ่านไม่รู้เรื่อง */
function truncAtWord(s, max) {
  s = clean(s);
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trim();
}

/**
 * สร้างชุด SEO ครบ
 * @param {object} i
 * @param {string} i.shortName  ชื่อสั้นที่ผู้ใช้พิมพ์ เช่น "ฮิตยุค 90"
 * @param {string[]} [i.tracklist]
 * @param {string} [i.capacity]  "4GB"
 * @param {number} [i.price]
 * @param {string} [i.categoryName]  บังคับหมวดเอง (ถ้าไม่ใส่ = เดาจากชื่อ)
 */
function buildSeo({ shortName, tracklist = [], capacity = '4GB', price = 279, categoryName } = {}) {
  const short = clean(shortName);
  const hay = `${short} ${(tracklist || []).slice(0, 40).join(' ')}`;
  const g = detectGenre(hay);
  const cat = CATEGORIES.includes(categoryName) ? categoryName : g.cat;
  const era = (short.match(/ยุค ?(\d{2,4})/) || [])[1] || null;
  const songs = tracklist.length || null;
  const artists = extractArtists(tracklist);
  const nSongs = songs ? `${songs} เพลง` : 'เพลงฮิตจัดเต็ม';

  // ── ชื่อสินค้า: คีย์เวิร์ดหลักหน้าสุด, ตัดให้ ≤ 120 ตัวอักษร ──
  const name = clean(
    `USB แฟลชไดรฟ์ MP3 รวมเพลง${short} ${songs ? songs + ' เพลง ' : ''}${capacity} ฟังในรถ ไม่ต้องใช้เน็ต`
  ).slice(0, 120);

  // ── 2 ประโยคแรก = meta description (155 ตัวแรกถูกตัดไปใช้) ──
  // ไม่เติม "ยุค xx" ซ้ำ — era ดึงมาจาก shortName เองอยู่แล้ว
  const hook = clean(
    `รวมเพลง${short} ${nSongs} ลงแฟลชไดรฟ์ USB ${capacity} พร้อมฟังทันที ` +
    `เสียบปุ๊บเล่นปั๊บในรถ ไม่ต้องต่อเน็ต ไม่มีโฆษณาคั่น MP3 320kbps เสียงคมชัด ส่งไวจากไทย`
  );

  const description = [
    hook,
    '',
    'สิ่งที่คุณได้รับ',
    `• ${nSongs}${artists.length ? ` — มีเพลงของ ${artists.slice(0, 4).join(', ')} และศิลปินดังอีกเพียบ` : ' คัดมาให้แล้ว ไม่ต้องเสียเวลาหาเอง'}`,
    '• ไฟล์ MP3 320kbps เสียงคมชัด เบสแน่น ฟังในรถได้อารมณ์เต็ม',
    '• ใช้ได้กับรถยนต์ทุกรุ่นที่มีช่อง USB ลำโพงบลูทูธ คอมพิวเตอร์ และสมาร์ททีวี',
    '• ตั้งชื่อไฟล์เรียงเลขเป็นระเบียบ เลื่อนหาเพลงง่าย แนบรายชื่อเพลงครบทุกแทร็ก',
    '• เพิ่ม-ลบเพลงเองได้ ใช้เป็นแฟลชไดรฟ์เก็บไฟล์ต่อได้ตามปกติ',
    '',
    `เหมาะกับใคร: คนขับรถที่อยากฟัง${g.name}โดยไม่ง้อสัญญาณเน็ต · คนชอบ${g.name}ตัวจริง · ` +
    'ซื้อเป็นของขวัญให้พ่อแม่ผู้ใหญ่ ใช้ง่ายไม่ต้องสอน เสียบแล้วฟังได้เลย',
    '',
    'วิธีใช้: เสียบแฟลชไดรฟ์เข้าช่อง USB ของเครื่องเสียงรถยนต์ → เลือกโหมด USB → เพลงเล่นอัตโนมัติ',
    '',
    `ความจุ ${capacity} · คุณภาพเสียง MP3 320kbps · ราคา ${price} บาท`,
    'แพ็กกันกระแทก ส่งไวจากไทย มีปัญหาเปลี่ยนใหม่ภายใน 7 วัน',
  ].join('\n');

  // ── tags: หมวด + long-tail ศิลปิน + คีย์เวิร์ดฐาน (ไม่ซ้ำ, ≤ 12) ──
  // ถ้ารู้ยุคแน่ชัด ตัดคีย์เวิร์ดที่อ้างยุคอื่นทิ้ง — "ยุค 80" กับ "ฮิตยุค 90" ในสินค้าเดียวกันขัดกันเอง
  const genreKw = era ? g.kw.filter(k => !/\d{2,4}/.test(k) || k.includes(era)) : g.kw;
  const tags = [...new Set([
    ...genreKw,
    ...(era ? [`เพลงยุค ${era}`] : []),
    ...artists.slice(0, 3),
    ...BASE_KW,
  ])].filter(Boolean).slice(0, 12);

  // metaTitle ≤ 60 ตัวก่อนต่อชื่อร้าน (Google แสดงราว 60-70) และตัดที่ขอบคำ
  const metaTitle = clean(`${truncAtWord(name, 52)} | Bt Music Drive`);
  const metaDescription = truncAtWord(hook, 155);

  // slug สั้น อ่านออก คีย์เวิร์ดหลักครบ — ไม่ลากทั้งชื่อยาวมาแปลง
  const slugBase = clean(`USB MP3 รวมเพลง${short} ${capacity}`);

  return {
    name,
    description,
    metaTitle,
    metaDescription,
    categoryName: cat,
    tags,
    artists,
    genre: g.name,
    songs,
    capacity,
    price,
    specs: {
      'ความจุ': capacity,
      'จำนวนเพลง': songs ? `${songs} เพลง` : '-',
      'คุณภาพเสียง': 'MP3 320kbps',
      'แนวเพลง': g.name,
      'รองรับ': 'รถยนต์ / ลำโพงบลูทูธ / คอมพิวเตอร์ / สมาร์ททีวี',
    },
    slug: slugify(slugBase),
    imageSlug: imageSlug(slugBase),
  };
}

/**
 * ตรวจคุณภาพ SEO ก่อนลง — คืน [{level:'warn'|'error', msg}]
 * @param {object} seo
 * @param {object[]} [others] สินค้าที่มีอยู่แล้ว (ตรวจชื่อ/slug ซ้ำ)
 */
function validateSeo(seo, others = []) {
  const out = [];
  const push = (level, msg) => out.push({ level, msg });

  if (!seo.name || seo.name.length < 25) push('error', 'ชื่อสินค้าสั้นเกินไป (ควร 40-120 ตัวอักษร)');
  if (seo.name && seo.name.length > 130) push('warn', `ชื่อยาว ${seo.name.length} ตัว — Google ตัดที่ ~60 ตัวแรก ให้คีย์เวิร์ดสำคัญอยู่ต้นชื่อ`);
  if (seo.name && !/USB|แฟลชไดรฟ์/i.test(seo.name)) push('warn', 'ชื่อไม่มีคำว่า USB / แฟลชไดรฟ์ — เสียคีย์เวิร์ดหลัก');

  const md = (seo.metaDescription || '').trim();
  if (md.length < 100) push('warn', `meta description ${md.length} ตัว — สั้นไป ควร 120-155`);
  if (md.length > 160) push('warn', `meta description ${md.length} ตัว — ยาวไป Google จะตัด`);

  if (!seo.description || seo.description.length < 300) push('warn', 'รายละเอียดสั้นเกิน 300 ตัว — หน้าสินค้าบางเกินไปสำหรับ SEO');
  if (!seo.tags || seo.tags.length < 5) push('warn', 'tags น้อยกว่า 5 — เพิ่มคีย์เวิร์ดที่คนค้นจริง');
  if (!seo.slug) push('error', 'สร้าง slug ไม่ได้');

  const nameKey = s => String(s || '').toLowerCase().replace(/\s+/g, '');
  const dupName = others.find(p => nameKey(p.name) === nameKey(seo.name));
  if (dupName) push('error', `ชื่อซ้ำกับสินค้าเดิม: ${dupName.name}`);
  const dupSlug = others.find(p => p.slug && p.slug === seo.slug);
  if (dupSlug) push('warn', `slug ซ้ำกับ ${dupSlug.name} — ระบบจะต่อท้ายเลขให้อัตโนมัติ`);

  if (!seo.tracklistCount && !seo.songs) push('warn', 'ยังไม่มีรายชื่อเพลง — เสียโอกาสติดคำค้นชื่อเพลง/ศิลปิน');

  return out;
}

module.exports = { buildSeo, validateSeo, detectGenre, extractArtists, CATEGORIES, GENRES };
