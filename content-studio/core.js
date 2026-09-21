(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ContentStudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PLATFORMS = { tiktok: 'TikTok', facebook: 'Facebook / Reels', instagram: 'Instagram Reels', youtube: 'YouTube Shorts', shop: 'โพสต์ขายสินค้า' };
  const STYLES = {
    showcase: ['โชว์รายละเอียด', 'Clean studio tabletop, bronze accents, dark slate backdrop, soft side lighting.', 'A slow macro push toward the real USB and its packaging.'],
    presenter: ['คนขายเล่า', 'Friendly Thai shop presenter, natural indoor daylight, tidy music corner.', 'A medium shot of the presenter holding the referenced USB package naturally.'],
    driving: ['เพื่อนร่วมทาง', 'Inside a stationary parked car, warm daylight, relaxed travel mood.', 'A close-up of a hand holding the referenced USB near the parked car console.'],
    nostalgia: ['เพลงกับความทรงจำ', 'Warm evening light, a familiar home listening corner, nostalgic mood.', 'A slow cinematic reveal of the referenced USB on a wooden table.'],
    energetic: ['จังหวะสนุก', 'Bright cheerful music corner, rhythmic but controlled camera movement.', 'A lively short lateral camera move revealing the referenced USB and packaging.'],
    promotion: ['ชวนเลือกชุดเพลง', 'Clean product display, warm spotlight, clear space around the product.', 'A deliberate push-in toward the referenced USB package with empty space for an offer overlay.'],
  };
  function safeUrl(value) {
    try { const u = new URL(String(value)); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
  }
  const trim = value => String(value ?? '').trim();
  const owns = (map, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(map, key);
  function concepts(brief) {
    const title = trim(brief.shortName);
    return [
      { id: 'feeling', title: 'เริ่มจากอารมณ์คนฟัง', hook: `มีเพลงแนวไหนที่ฟังทีไรก็อารมณ์ดี?`, description: `เปิดด้วยบรรยากาศที่คนดูคุ้นเคย แล้วพาไปรู้จัก ${title}` },
      { id: 'product', title: 'ให้สินค้าเป็นพระเอก', hook: `มาดูชุดเพลงนี้ใกล้ ๆ กัน`, description: `เห็น USB และแพ็กเกจตั้งแต่ต้น เน้นรายละเอียดของ ${title}` },
      { id: 'question', title: 'เปิดด้วยคำถาม', hook: `ถ้าเลือกเพลงไปฟังได้หนึ่งชุด คุณจะเลือกแนวไหน?`, description: 'ชวนคนดูมีส่วนร่วม ก่อนแนะนำชุดเพลงและช่องทางดูรายละเอียด' },
    ];
  }
  function validateBrief(b) {
    if (!trim(b.shortName)) throw new Error('กรอกชื่อสินค้าสำหรับพูดในคลิป');
    if (!b.factsConfirmed) throw new Error('ตรวจข้อมูลสินค้าและทำเครื่องหมายยืนยันก่อน');
    if (!Array.isArray(b.references) || !b.references.some(safeUrl)) throw new Error('เลือกรูปอ้างอิงอย่างน้อย 1 รูป');
    if (b.includePrice && (!Number.isFinite(Number(b.price)) || Number(b.price) < 0 || trim(b.price) === '')) throw new Error('กรอกราคาที่ถูกต้อง');
    if (!owns(STYLES, b.style) || !['9:16', '16:9'].includes(b.aspect) || ![16, 24, 32].includes(Number(b.duration)) || !['voiceover', 'dialogue', 'none'].includes(b.voice)) throw new Error('การตั้งค่าคลิปไม่ถูกต้อง');
  }
  function makeScene(b, concept, index, count, variant = 0) {
    const last = index === count - 1;
    const kind = index === 0 ? 'เปิดคลิป' : last ? 'ชวนดูสินค้า' : index === 1 ? 'แนะนำสินค้า' : 'เก็บรายละเอียด';
    const style = STYLES[b.style];
    const price = b.includePrice ? ` ราคา ${Number(b.price).toLocaleString('th-TH')} บาท` : '';
    const facts = trim(b.facts);
    const name = spokenName(b.shortName);
    const lines = index === 0 ? [`ลองดู${name}ชุดนี้กันครับ`, `วันนี้มี${name}มาให้ดูกันครับ`, `ใครกำลังเลือกชุดเพลง ลองดู${name}ครับ`]
      : last ? [`ชุดนี้${price || 'น่าสนใจไหมครับ'} ดูรายชื่อเพลงก่อนได้ครับ`, `สนใจชุดนี้${price} ดูรายละเอียดในโพสต์ได้ครับ`, `เลือกชุดที่ชอบ${price} สอบถามรายละเอียดกับร้านได้ครับ`]
      : index===1 ? [`นี่คือตัว USB และแพ็กเกจของชุดนี้ครับ`, `มาดูตัวแฟลชไดร์ฟของชุดนี้ใกล้ ๆ กันครับ`, `ดูตัวสินค้าและแพ็กเกจกันชัด ๆ ครับ`]
      : [`ก่อนเลือก ลองดูว่ามีเพลงที่ชอบไหมครับ`, `เลือกแนวเพลงที่ชอบไว้ฟังกันครับ`, `ถ้าชอบเพลงแนวนี้ ลองดูรายละเอียดชุดนี้ครับ`];
    const speech = b.voice === 'none' ? '' : lines[variant % lines.length];
    const action = b.voice==='dialogue' ? 'The presenter keeps holding the referenced USB package at chest height, facing the camera. Continue the same conversation with only subtle facial expression.' : 'Keep the referenced USB and packaging stationary in the same tabletop arrangement. Continue the same product demonstration.';
    const camera = 'Locked camera and fixed framing. One uninterrupted shot, no camera repositioning or cut.';
    const scene = { title: kind, seconds: Number(b.duration) / count, visual: `${style[1]} ${action}`, speech,
      overlay: last ? `${b.shortName}${price} · ดูรายละเอียดสินค้า` : index === 0 ? concept.hook : b.shortName,
      references: b.references.map(safeUrl).filter(Boolean), variant, prompt: '',
      warning: speech.length > 110 ? 'บทพูดอาจยาวเกินฉากนี้ ควรย่อก่อนนำไปสร้าง' : '' };
    scene.prompt = [
      `Create one ${scene.seconds}-second ${b.aspect} product video shot (adjust duration to the selected Flow model).`,
      `Scene ${index + 1}: ${scene.title}. ${scene.visual}`, camera,
      b.voice === 'dialogue' ? 'Include the same friendly Thai presenter speaking on camera.' : '',
      trim(b.continuity) ? `Continuity notes for every shot: ${trim(b.continuity)}` : 'Use the same product, packaging, lighting and setting across all shots.',
      'Use the attached product reference images. Preserve the USB shape, proportions, colors and packaging. Do not invent additional products or accessories.',
      `Product identity (context, not on-screen text): ${b.shortName}.`,
      trim(b.audience) ? `Intended viewers: ${trim(b.audience)}.` : '',
      speech ? `${b.voice === 'dialogue' ? 'Thai on-camera dialogue' : 'Thai voiceover'}, spoken naturally: ${JSON.stringify(speech)}` : 'No speech or dialogue. Subtle environmental sound only.',
      'Do not generate background songs. Leave music for editing. No generated captions, logos, price labels or text overlays; these will be added in editing.',
      'Maintain realistic hands and rigid USB geometry. Do not show unverified device compatibility or invented playback screens.',
    ].filter(Boolean).join('\n\n');
    return scene;
  }
  function spokenName(value) {
    const name=trim(value).replace(/USB\s*แฟลชไดร[์]?ฟ[์]?\s*-?\s*/gi,'').replace(/แฟลชไดร์ฟรวมเพลง/g,'').replace(/^MP3\s*/i,'').replace(/^รวมเพลง\s*/,'เพลง').trim();
    return name.length<=55?name:'แฟลชไดร์ฟเพลง';
  }
  function continuityAnchor(b) {
    return b.voice==='dialogue'
      ? 'Fixed medium shot. The same presenter faces the camera, holding the same referenced USB package at chest height with both hands. Hands, product orientation and camera position stay unchanged.'
      : 'Fixed close product shot. The same referenced USB lies beside its packaging on the same surface, in exactly the same position and orientation. Camera and objects stay still.';
  }
  function connectScenes(b, scenes) {
    const anchor=continuityAnchor(b);
    return scenes.map((s,i)=>{
      const base=s.prompt.replace(/\n*\[CONTINUOUS CLIP\][\s\S]*?\[\/CONTINUOUS CLIP\]/g,'').trim();
      const block=[`[CONTINUOUS CLIP]`, `This is segment ${i+1} of ${scenes.length} in ONE continuous ${b.duration}-second conversation/demo, not a separate advertisement.`,
        i===0?'Start from the supplied product reference. Establish this composition once.':`Use the actual last frame of segment ${i} as this segment's starting frame in Flow. Continue exactly where it ended; no new introduction, location, person or product reveal.`,
        `Required START frame: ${anchor}`,`Required END frame: ${anchor} Hold this pose still for the final 0.5 seconds; finish speaking before the hold.`,
        'Keep the same face, clothes, voice, room, lighting, focal length and product throughout. These boundary instructions override any conflicting camera movement in the draft above.',
        'Speak only this segment’s dialogue; do not repeat earlier lines. No scene transition, fade-in or fade-out inside the shot.',`[/CONTINUOUS CLIP]`].join('\n');
      return {...s,prompt:`${base}\n\n${block}`};
    });
  }
  function makeScenes(b, concept) { validateBrief(b); const count = Number(b.duration) / 8; return connectScenes(b,Array.from({ length: count }, (_, i) => makeScene(b, concept, i, count))); }
  function makePosts(b, settings, actual, selected) {
    if (!trim(actual.summary)) throw new Error('สรุปสิ่งที่อยู่ในวิดีโอจริงก่อนสร้างชุดโพสต์');
    if (!actual.confirmed) throw new Error('ตรวจข้อมูลและราคาสำหรับวันที่จะโพสต์ก่อน');
    if (!selected.length) throw new Error('เลือกอย่างน้อย 1 แพลตฟอร์ม');
    if (b.includePrice && (trim(b.price) === '' || !Number.isFinite(Number(b.price)) || Number(b.price) < 0)) throw new Error('ตรวจราคาสินค้าอีกครั้ง');
    const name = trim(b.shortName);
    const store = trim(settings.storeName) || 'BT Music Drive';
    const hook = trim(actual.hook) || `มารู้จัก ${name} กัน`;
    const price = b.includePrice ? `ราคา ${Number(b.price).toLocaleString('th-TH')} บาท` : '';
    const tags = '#แฟลชไดร์ฟเพลง #USBMP3 #BTMusicDrive';
    const detail = [trim(actual.summary), trim(b.facts), price].filter(Boolean).join('\n');
    return [...new Set(selected)].filter(k => owns(PLATFORMS, k)).map(platform => {
      const channel = trim(settings.channels?.[platform]);
      const webLink = ['facebook', 'shop'].includes(platform) ? safeUrl(settings.productLink) : '';
      const cta = actual.goal === 'engage' ? 'คุณชอบฟังเพลงแนวไหน? คอมเมนต์คุยกันได้เลย'
        : actual.goal === 'awareness' ? `รู้จักชุดเพลงอื่น ๆ ได้ที่ ${store}`
        : channel || (webLink ? 'ดูรายชื่อเพลงและรายละเอียดสินค้าได้ที่ลิงก์นี้' : `สอบถามรายละเอียดกับ ${store}`);
      const title = platform === 'youtube' ? `${name} | ${hook}` : platform === 'shop' ? name : hook;
      const body = platform === 'tiktok' ? [hook, actual.summary, price, cta, tags]
        : platform === 'instagram' ? [hook, actual.summary, price, cta, tags]
        : platform === 'youtube' ? [actual.summary, name, price, cta, tags]
        : platform === 'shop' ? [name, detail, cta, webLink]
        : [hook, detail, `จาก ${store}`, cta, webLink, tags];
      return { platform, title, cover: name, body: body.filter(Boolean).join('\n\n'), status: 'draft', url: '' };
    });
  }
  function asText(project) {
    return [`BT Music Drive — ${project.brief.shortName}`, 'Content Studio · ตรวจข้อมูลก่อนใช้',
      `แนวคลิป: ${STYLES[project.brief.style]?.[0] || ''} | ${project.brief.aspect}`, '',
      ...project.scenes.flatMap((s, i) => [`ฉาก ${i + 1}: ${s.title} (${s.seconds} วินาที)`, s.prompt, `บทพูด: ${s.speech || 'ไม่มี'}`, `ข้อความวางตอนตัดต่อ: ${s.overlay}`, 'รูปที่ต้องแนบ:', ...s.references, '']),
      'สรุปวิดีโอจริง:', project.actual?.summary || 'ยังไม่ได้กรอก', '',
      ...project.posts.flatMap(p => [PLATFORMS[p.platform], `ชื่อ: ${p.title}`, `หน้าปก: ${p.cover}`, p.body, `สถานะ: ${p.status}`, p.url || '', '']),
    ].join('\n');
  }
  // Explicit schema allowlist for backups: imported text is never HTML or executable code.
  function normalizeProject(raw) {
    const text = (v, limit = 5000) => { if (typeof v !== 'string' || v.length > limit) throw new Error('ไฟล์งานมีข้อความที่ไม่ถูกต้องหรือยาวเกินไป'); return v; };
    if (!raw || raw.version !== 1 || !raw.brief || !Array.isArray(raw.scenes) || raw.scenes.length > 4 || !Array.isArray(raw.posts) || raw.posts.length > 5) throw new Error('ไฟล์นี้ไม่ใช่งาน Content Studio รุ่นที่รองรับ');
    const b = raw.brief;
    const references = Array.isArray(b.references) ? b.references.slice(0, 20).map(safeUrl).filter(Boolean) : [];
    const brief = { shortName: text(b.shortName, 200), audience: text(b.audience || '', 200), facts: text(b.facts || '', 1800),
      price: text(String(b.price ?? ''), 30), includePrice: b.includePrice === true, style: text(b.style, 30), aspect: text(b.aspect, 10),
      duration: Number(b.duration), voice: text(b.voice, 30), continuity: text(b.continuity || '', 1000), references, factsConfirmed: b.factsConfirmed === true };
    if (!owns(STYLES, brief.style) || !['9:16', '16:9'].includes(brief.aspect) || ![16,24,32].includes(brief.duration) || !['voiceover','dialogue','none'].includes(brief.voice)) throw new Error('การตั้งค่าในไฟล์งานไม่ถูกต้อง');
    const scenes = raw.scenes.map(s => ({ title: text(s.title, 200), seconds: 8, visual: text(s.visual || ''), speech: text(s.speech || ''), overlay: text(s.overlay || ''),
      prompt: text(s.prompt, 12000), references: Array.isArray(s.references) ? s.references.slice(0,20).map(safeUrl).filter(Boolean) : references,
      variant: Number.isInteger(s.variant) && s.variant >= 0 ? s.variant % 3 : 0, warning: text(s.warning || '', 300) }));
    const seen = new Set();
    const posts = raw.posts.map(p => {
      if (!owns(PLATFORMS, p.platform) || seen.has(p.platform) || !['draft','ready','posted'].includes(p.status)) throw new Error('แพลตฟอร์มหรือสถานะในไฟล์ไม่ถูกต้อง');
      seen.add(p.platform);
      return { platform:p.platform, title:text(p.title,1000), cover:text(p.cover,1000), body:text(p.body,10000), status:p.status, url:safeUrl(p.url) };
    });
    const settings = { storeName: text(raw.settings?.storeName || 'BT Music Drive',100), productLink:safeUrl(raw.settings?.productLink), channels:{} };
    for (const k of Object.keys(PLATFORMS)) settings.channels[k] = text(raw.settings?.channels?.[k] || '',300);
    const actual = { summary:text(raw.actual?.summary || '',2000), hook:text(raw.actual?.hook || '',300), confirmed:raw.actual?.confirmed === true,
      goal:['sell','engage','awareness'].includes(raw.actual?.goal) ? raw.actual.goal : 'sell', videoName:text(raw.actual?.videoName || '',500) };
    const concept = raw.concept ? { id:text(raw.concept.id,50), title:text(raw.concept.title,200), hook:text(raw.concept.hook,300), description:text(raw.concept.description || '',1000) } : null;
    if (scenes.length && (!concept || scenes.length < 2)) throw new Error('ไฟล์งานขาดไอเดียหรือฉากไม่ครบ');
    return { version:1, id:text(raw.id,100), productId:text(raw.productId,200), brief, scenes, posts, settings, actual, concept,
      selectedPlatforms:Array.isArray(raw.selectedPlatforms) ? [...new Set(raw.selectedPlatforms.filter(k=>owns(PLATFORMS,k)))] : Object.keys(PLATFORMS),
      updatedAt:text(raw.updatedAt || '',100), staleScenes:raw.staleScenes === true, stalePosts:raw.stalePosts === true };
  }
  return { PLATFORMS, STYLES, safeUrl, concepts, validateBrief, makeScene, makeScenes, makePosts, asText, normalizeProject, spokenName, continuityAnchor, connectScenes };
});
