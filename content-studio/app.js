'use strict';
(() => {
  const C = window.ContentStudio;
  const $ = id => document.getElementById(id);
  const HISTORY_KEY = 'btmusicdrive_content_studio_projects_v1';
  const SETTINGS_KEY = 'btmusicdrive_content_studio_settings_v1';
  const defaults = () => ({ storeName:'BT Music Drive', productLink:'', channels:{ tiktok:'สอบถามรายละเอียดกับ BT Music Drive', facebook:'', instagram:'สอบถามรายละเอียดทางข้อความของร้าน', youtube:'สอบถามรายละเอียดกับ BT Music Drive', shop:'' } });
  let products = [], project = null, dirty = false, videoUrl = '', currentTab = 'brief';
  let history = [], savedSettings = defaults();
  let aiController=null;
  const useAI=()=>$('generator').value!=='template';
  const instructionPresets = [
    ['แนวขายและน้ำเสียง', [
      ['เพื่อนแนะนำเพื่อน', 'เล่าเหมือนเพื่อนแนะนำชุดเพลงที่น่าสนใจ ใช้ภาษาไทยพูดสั้น ๆ เป็นกันเอง ไม่พูดเหมือนอ่านโฆษณา'],
      ['ขายเนียน ไม่เร่งซื้อ', 'เริ่มจากความชอบหรือสถานการณ์ของคนฟัง แล้วค่อยแนะนำสินค้าที่เลือก จบด้วยชวนดูรายละเอียด ไม่เร่งให้ซื้อ'],
      ['คนขายพูดตรง ๆ', 'ใช้เสียงคนขายที่คุยง่าย บอกว่าสินค้าคืออะไร เหมาะกับคนชอบเพลงแนวไหน และชวนดูรายชื่อเพลง โดยใช้เฉพาะข้อมูลที่ยืนยันแล้ว'],
      ['อบอุ่น สุภาพ', 'เล่าอย่างอบอุ่น สุภาพ ไม่เป็นทางการเกินไป ให้ความรู้สึกเหมือนคุยกับลูกค้าประจำ ใช้คำง่ายและประโยคสั้น'],
      ['กระชับ เข้าเรื่องทันที', 'พูดถึงสินค้าหรือความชอบของคนฟังตั้งแต่ประโยคแรก ตัดคำเกริ่นยาว ทุกฉากมีใจความเดียวและไม่พูดซ้ำ'],
    ]],
    ['เปิดคลิปให้น่าดู', [
      ['เปิดด้วยคำถามคนฟัง', 'เปิดด้วยคำถามเฉพาะเจาะจงเกี่ยวกับนิสัยฟังเพลงที่เข้ากับสินค้าที่เลือก ให้คนดูรู้สึกอยากตอบ แล้วเชื่อมไปหาสินค้า'],
      ['เปิดด้วยเหตุการณ์เล็ก ๆ', 'เปิดด้วยเหตุการณ์ในชีวิตประจำวันที่เกี่ยวกับการเลือกเพลง เช่น เตรียมตัวออกเดินทาง แล้วค่อยเผยสินค้า ไม่สร้างเหตุการณ์ซับซ้อน'],
      ['โชว์ USB ตั้งแต่แรก', 'ให้ตัว USB หรือแพ็กเกจอ้างอิงปรากฏตั้งแต่ฉากแรก ใช้ประโยคสั้นชวนดูรายละเอียด และให้สินค้ายังเป็นจุดสนใจตลอดคลิป'],
      ['เปิดแบบชวนเลือก', 'เปิดด้วยการชวนคนดูเลือกบรรยากาศฟังเพลงสองแบบที่เกี่ยวข้องกับแนวเพลงของสินค้านี้ แล้วพาไปดูสินค้าที่เลือก'],
      ['ทักคนชอบเพลงแนวนี้', 'เปิดด้วยการเรียกคนชอบแนวเพลงของสินค้าที่เลือกอย่างเป็นกันเอง แล้วบอกเหตุผลที่ควรดูต่อจากจุดขายที่ยืนยันแล้ว'],
    ]],
    ['สถานการณ์และเรื่องราว', [
      ['เตรียมเพลงก่อนเดินทาง', 'เล่าเหตุการณ์คนกำลังเลือกชุดเพลงก่อนเดินทาง ถ่ายในรถที่จอดนิ่ง โชว์ USB กับแพ็กเกจ ไม่กล่าวอ้างว่าใช้ได้กับรถทุกรุ่น'],
      ['มุมฟังเพลงที่บ้าน', 'วางเรื่องในมุมพักผ่อนที่บ้าน มีคนหยิบ USB และแพ็กเกจมาดู บรรยากาศสบาย ๆ ไม่แต่งรายละเอียดอุปกรณ์ที่รองรับ'],
      ['แนะนำหน้าร้าน', 'ให้พรีเซนเตอร์แนะนำชุดเพลงจากมุมเคาน์เตอร์ร้าน หยิบสินค้าขึ้นมาโชว์และพูดกับกล้องแบบคุยกับลูกค้า ไม่สมมติว่าเป็นรีวิวลูกค้าจริง'],
      ['เลือกเพลงให้คนในบ้าน', 'เล่าเรื่องคนกำลังเลือกแนวเพลงให้คนในบ้านฟัง โดยถามถึงความชอบ ไม่เหมารวมความชอบตามอายุ และไม่อ้างว่าเคยซื้อหรือใช้จริง'],
      ['วันหยุดกับชุดเพลง', 'เล่าบรรยากาศเลือกเพลงสำหรับวันหยุด เริ่มจากกิจกรรมง่าย ๆ แล้วหยิบสินค้ามาแนะนำ ให้ความรู้สึกผ่อนคลาย'],
    ]],
    ['อารมณ์ตามแนวเพลง', [
      ['สามช่า สนุกเป็นกันเอง', 'ถ้าสินค้าที่เลือกเป็นแนวสามช่า ให้ภาพสดใส จังหวะการเล่ากระฉับกระเฉง พูดเป็นกันเอง ไม่ร้องเพลงหรือแต่งชื่อเพลงเพิ่ม'],
      ['เพื่อชีวิต เรียบง่าย', 'ถ้าสินค้าเป็นเพลงเพื่อชีวิต ให้บรรยากาศเรียบง่าย จริงใจ เชื่อมกับการพักผ่อนหรือเดินทาง ใช้คำพูดธรรมดา ไม่ใช้ภาษากวี'],
      ['สตริงยุค 90 ชวนคิดถึง', 'ถ้าข้อมูลสินค้าเป็นเพลงยุค 90 ให้เล่าความรู้สึกคิดถึงช่วงเวลาฟังเพลงในอดีต โดยไม่แต่งชื่อศิลปิน ชื่อเพลง หรือประสบการณ์ของลูกค้า'],
      ['ลูกกรุง นุ่มนวล', 'ถ้าสินค้าเป็นเพลงลูกกรุง ให้ภาพและน้ำเสียงนุ่มนวล สุภาพ จังหวะไม่รีบ เน้นบรรยากาศฟังเพลงสบาย ๆ'],
      ['ลูกทุ่ง คุยง่าย', 'ถ้าสินค้าเป็นเพลงลูกทุ่ง ให้เล่าแบบเข้าถึงง่ายและอบอุ่น ใช้ภาษาไทยกลางเป็นธรรมชาติ ไม่บังคับสำเนียงหรือแต่งชื่อศิลปิน'],
    ]],
    ['ภาพและการเคลื่อนกล้อง', [
      ['โชว์สินค้าแบบพรีเมียม', 'ใช้ภาพสินค้าเรียบหรู พื้นหลังสีเข้ม แสงด้านข้างอ่อน ๆ เคลื่อนกล้องช้า รักษารูปทรงและแพ็กเกจตามภาพอ้างอิง'],
      ['ถ่ายใกล้รายละเอียด USB', 'ใช้ภาพระยะใกล้ที่มองเห็นรูปทรง USB ชัดเจน หนึ่งฉากมีการเคลื่อนกล้องเพียงแบบเดียว ไม่สร้างรายละเอียดสินค้าที่ไม่มีในภาพอ้างอิง'],
      ['มือถือถ่าย เป็นธรรมชาติ', 'ให้ภาพเหมือนคลิปที่ถ่ายด้วยมือถือในแสงธรรมชาติ กล้องเคลื่อนเล็กน้อยอย่างนุ่มนวล คนพูดเป็นกันเอง ไม่ทำให้ดูเป็นรีวิวจากลูกค้าจริง'],
      ['โชว์ด้วยมือ ไม่เห็นหน้า', 'ไม่แสดงใบหน้าพรีเซนเตอร์ ใช้มือหยิบหรือวางสินค้าอย่างเรียบง่าย เน้นตัว USB และแพ็กเกจ ให้เสียงบรรยายถ้าเลือกโหมดมีเสียงพูด'],
      ['เว้นพื้นที่ใส่ข้อความ', 'จัดภาพให้สินค้าชัดและเหลือพื้นที่ว่างสำหรับวางชื่อสินค้าและคำชวนซื้อในขั้นตอนตัดต่อ ไม่ให้ Flow สร้างตัวหนังสือในภาพ'],
    ]],
    ['ปรับบทและแก้เฉพาะฉาก', [
      ['ทำภาษาไทยให้เป็นธรรมชาติ', 'เกลาประโยคให้เหมือนคนไทยพูดจริง ใช้คำธรรมดา ตัดคำแปลตรงตัว ภาษากวี และคำเปรียบเทียบที่ไม่ชัด คงชื่อสินค้าและแนวเพลงตามต้นฉบับ'],
      ['ย่อบทให้พูดทัน', 'ย่อบทพูดให้หนึ่งฉากมีหนึ่งประโยคสั้น พูดได้สบายในเวลาประมาณ 8 วินาที ไม่ยัดหลายจุดขายไว้ในประโยคเดียว'],
      ['เพิ่มความสนุกพอดี', 'เพิ่มความขี้เล่นเล็กน้อยจากสถานการณ์เลือกเพลง ใช้มุกที่เข้าใจง่าย ไม่ล้อเลียนลูกค้า และไม่ทำให้จุดขายของสินค้าหายไป'],
      ['เปลี่ยนฉากเปิดให้ใหม่', 'สำหรับฉากที่ขอแก้ ให้เปลี่ยนวิธีเปิดเรื่องและมุมกล้องจากเดิม ใช้เหตุการณ์ที่เข้าใจทันที และรักษาสินค้า พรีเซนเตอร์ และบรรยากาศให้ต่อกับฉากอื่น'],
      ['จบแบบไม่ขายแข็ง', 'สำหรับฉากที่ขอแก้ ให้จบด้วยคำชวนดูรายชื่อเพลงหรือรายละเอียดสินค้าอย่างเป็นกันเอง ไม่เร่งซื้อ ไม่อ้างของใกล้หมดหรือโปรโมชันที่ไม่ได้ยืนยัน'],
    ]],
    ['เขียนโพสต์แต่ละช่องทาง', [
      ['TikTok สั้น ชวนคุย', 'ถ้าสร้างโพสต์ TikTok ให้แคปชันสั้น เปิดด้วยคำถามที่เกี่ยวกับคลิปจริง จบด้วยช่องทางติดต่อที่ตั้งไว้ ใช้แฮชแท็กที่เกี่ยวข้อง ไม่อ้างว่ามีตะกร้าถ้ายังไม่ระบุ'],
      ['Facebook เล่าเรื่องก่อนขาย', 'ถ้าสร้างโพสต์ Facebook ให้เริ่มจากเรื่องใกล้ตัวของคนฟังเพลง ต่อด้วยจุดขายที่ยืนยันแล้ว และจบด้วยช่องทางดูรายละเอียด แบ่งย่อหน้าให้อ่านง่าย'],
      ['Instagram เน้นบรรยากาศ', 'ถ้าสร้างโพสต์ Instagram ให้แคปชันสะท้อนบรรยากาศในคลิปจริง ใช้ข้อความกระชับ พร้อมคำชวนติดต่อจากการตั้งค่าร้าน ไม่แต่งลิงก์หน้าโปรไฟล์'],
      ['YouTube ชื่อคลิปชัดเจน', 'ถ้าสร้างโพสต์ YouTube ให้ชื่อคลิปบอกประเภทสินค้าและแนวเพลงชัด ใช้คำค้นธรรมชาติ คำอธิบายตรงกับคลิป ไม่พาดหัวเกินจริง'],
      ['โพสต์ขาย อ่านแล้วเข้าใจ', 'ถ้าสร้างโพสต์ขายสินค้า ให้บอกว่าเป็นสินค้าอะไร เหมาะกับคนชอบเพลงแนวไหน ตามด้วยข้อมูลที่ยืนยันแล้วและช่องทางซื้อ ไม่เพิ่มเงื่อนไขรับประกันหรือจัดส่งเอง'],
    ]],
    ['เป้าหมายและคำชวนท้ายคลิป', [
      ['ชวนดูรายชื่อเพลง', 'จบด้วยการชวนดูรายชื่อเพลงของสินค้าที่เลือกก่อนตัดสินใจ โดยใช้ช่องทางร้านที่ระบุไว้ ไม่แต่งรายชื่อเพลงเพิ่มเติม'],
      ['ชวนคอมเมนต์แนวเพลง', 'จบด้วยคำถามว่าคนดูชอบฟังเพลงแนวไหน หรือฟังเพลงช่วงเวลาใด ให้ตอบได้ง่ายและเกี่ยวกับสินค้าหรือคลิปนี้'],
      ['ชวนส่งให้เพื่อน', 'จบด้วยคำชวนส่งคลิปให้เพื่อนที่ชอบเพลงแนวเดียวกันอย่างเป็นธรรมชาติ ไม่สั่งให้แชร์ซ้ำหลายครั้ง'],
      ['ชวนสอบถามรายละเอียด', 'จบด้วยการชวนถามรายละเอียดสินค้าผ่านช่องทางที่ตั้งไว้ ใช้ถ้อยคำสุภาพ ไม่รับปากว่าจะตอบทันทีหรือมีบริการที่ไม่ได้ระบุ'],
      ['แนะนำสินค้า ไม่ใส่ราคา', 'เน้นทำให้คนรู้จักสินค้าและแนวเพลง ไม่ใส่ราคา โปรโมชัน หรือส่วนลดในงานนี้ จบด้วยชวนดูรายละเอียดจากร้าน'],
    ]],
  ];
  for(const [groupName,presets] of instructionPresets){
    const group=document.createElement('optgroup');group.label=groupName;
    for(const [title,instruction] of presets){const option=document.createElement('option');option.textContent=title;option.value=instruction;group.append(option);}
    $('instruction-preset').append(group);
  }
  $('instruction-preset').addEventListener('change',()=>{
    const selected=$('instruction-preset').selectedOptions[0],instruction=selected.value;
    if(!instruction)return;
    const input=$('ai-instruction'),existing=input.value.trim();
    if($('instruction-append').checked&&existing.includes(instruction)){
      $('instruction-status').textContent='ตัวอย่างนี้อยู่ในคำสั่งแล้ว เลือกแบบอื่นเพื่อเพิ่มได้';
    }else{
      const next=$('instruction-append').checked&&existing?`${existing}\n${instruction}`:instruction;
      if(next.length>input.maxLength){$('instruction-status').textContent='คำสั่งรวมเกิน 1,500 ตัวอักษร กรุณาย่อข้อความเดิมก่อนเพิ่ม ตัวอย่างใหม่ยังไม่ถูกเติม';}
      else{input.value=next;input.dispatchEvent(new Event('input',{bubbles:true}));$('instruction-status').textContent=`เพิ่ม “${selected.textContent}” แล้ว · แก้ไขข้อความได้ก่อนกดสร้าง (${next.length}/1,500 ตัวอักษร)`;}
    }
    $('instruction-preset').value='';
  });
  $('generator').addEventListener('change',()=>{$('paid-settings').hidden=$('generator').value!=='openai';});
  async function configurePaid(disconnect){
    const apiKey=$('paid-key').value.trim();$('paid-key').value='';
    try{const res=await fetch('/api/ai/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(disconnect?{disconnect:true}:{apiKey,model:$('paid-model').value})});
      const data=await res.json();if(!res.ok)throw new Error(data.error);
      $('paid-status').textContent=data.configured?`ตั้งค่าคีย์สำหรับ ${data.model} แล้ว · จะตรวจสิทธิ์เมื่อกดสร้างครั้งแรก`:'ล้างคีย์แล้ว';
    }catch(err){$('paid-status').textContent=err.message;}
  }
  $('paid-connect').addEventListener('click',()=>configurePaid(false));
  $('paid-disconnect').addEventListener('click',()=>configurePaid(true));
  async function refreshAI(){
    try{const res=await fetch('/api/ai/status');if(!res.ok)throw new Error();const data=await res.json();$('ai-status').textContent=`${data.model} · ${data.message}`;
      $('paid-status').textContent=data.openai?.configured?`ตั้งค่าคีย์สำหรับ ${data.openai.model} แล้ว`:'ยังไม่ได้ตั้งค่าคีย์ OpenAI';}
    catch{$('ai-status').textContent='เชื่อมต่อ AI ไม่ได้ กรุณาเปิด Ollama และเริ่ม Content Studio ใหม่';}
  }
  async function generateAI(task,index){
    collect();
    const payload={task,index,provider:$('generator').value,project:structuredClone(project),instruction:$('ai-instruction').value.trim()};
    const controls=[...document.querySelectorAll('button,input,textarea,select')].filter(e=>!e.disabled&&e.id!=='ai-cancel');
    controls.forEach(e=>e.disabled=true);$('ai-cancel').hidden=false;
    aiController=new AbortController();const started=Date.now();
    const tick=()=>{$('ai-status').textContent=`${payload.provider==='openai'?'OpenAI API':'GPT OSS 20B'} กำลังคิด… ${Math.floor((Date.now()-started)/1000)} วินาที`;};
    tick();const timer=setInterval(tick,1000);
    try{
      const res=await fetch('/api/ai/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:aiController.signal});
      const data=await res.json();if(!res.ok)throw new Error(data.error||'สร้างข้อความไม่สำเร็จ');
      project.generator=data.model;return data.items;
    }catch(err){throw new Error(err.name==='AbortError'?'ยกเลิกแล้ว งานเดิมยังอยู่':err.message);}
    finally{clearInterval(timer);aiController=null;controls.forEach(e=>e.disabled=false);$('ai-cancel').hidden=true;refreshAI();}
  }
  $('ai-cancel').addEventListener('click',()=>aiController?.abort());
  $('ai-refresh').addEventListener('click',refreshAI);
  function notify(message) { $('notice').textContent = message; $('notice').hidden = !message; }
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    if (!Array.isArray(saved)) throw new Error();
    for (const item of saved) { try { history.push(C.normalizeProject(item)); } catch { notify('พบงานเก่าบางรายการที่อ่านไม่ได้ ข้ามรายการนั้นแล้ว'); } }
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (settings && typeof settings.storeName === 'string') {
      savedSettings.storeName = settings.storeName.slice(0,100);
      for (const k of Object.keys(C.PLATFORMS)) if (typeof settings.channels?.[k] === 'string') savedSettings.channels[k] = settings.channels[k].slice(0,300);
    }
  } catch { notify('อ่านข้อมูลที่บันทึกไว้ไม่ได้ คุณยังทำงานและส่งออกไฟล์ได้'); }
  function node(tag, text, className) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e; }
  function button(text, action, className = 'studio-button') { const e = node('button',text,className); e.type='button'; e.addEventListener('click',action); return e; }
  function ask(message) {
    return new Promise(resolve => {
      const dialog = $('confirm-dialog'); $('confirm-message').textContent = message;
      const finish = value => { dialog.close(); $('confirm-ok').onclick = null; $('confirm-cancel').onclick = null; dialog.oncancel = null; resolve(value); };
      $('confirm-ok').onclick = () => finish(true); $('confirm-cancel').onclick = () => finish(false);
      dialog.oncancel = e => { e.preventDefault(); finish(false); }; dialog.showModal();
    });
  }
  function markDirty() { dirty=true; $('save-status').textContent='มีการแก้ไขที่ยังไม่ได้บันทึก'; }
  function switchTab(tab) {
    currentTab=tab;
    for (const key of ['brief','scenes','posts']) $('panel-'+key).hidden=key!==tab;
    document.querySelectorAll('[data-tab]').forEach(b => { if (b.dataset.tab===tab) b.setAttribute('aria-current','step'); else b.removeAttribute('aria-current'); });
    if (project?.staleScenes && tab==='scenes') notify('ข้อมูลคลิปเปลี่ยนแล้ว กรุณาเลือกไอเดียและสร้างฉากใหม่ก่อนคัดลอก');
    else if (project?.stalePosts && tab==='posts') notify('ข้อมูลเปลี่ยนแล้ว กรุณาตรวจและสร้างชุดโพสต์ใหม่');
  }
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
  function collect() {
    if (!project) return;
    project.brief = { shortName:$('short-name').value.trim(), audience:$('audience').value.trim(), facts:$('facts').value.trim(),
      price:$('price').value, includePrice:$('include-price').checked, style:$('style').value, aspect:$('aspect').value, duration:Number($('duration').value),
      voice:$('voice').value, continuity:$('continuity').value.trim(), factsConfirmed:$('facts-confirmed').checked,
      references:[...$('reference-images').querySelectorAll('input:checked')].map(i=>i.value) };
    project.settings = { storeName:$('store-name').value.trim(), productLink:$('product-link').value.trim(), channels:{} };
    for (const key of Object.keys(C.PLATFORMS)) project.settings.channels[key]=$('channel-'+key).value.trim();
    project.actual = { ...project.actual, summary:$('actual-summary').value.trim(), hook:$('post-hook').value.trim(), goal:$('goal').value, confirmed:$('posts-confirmed').checked };
    project.selectedPlatforms=[...$('platform-options').querySelectorAll('input:checked')].map(i=>i.value);
  }
  for (const [key,name] of Object.entries(C.PLATFORMS)) {
    const label=node('label',undefined,'studio-check'), input=node('input'); input.type='checkbox';input.value=key;input.checked=true;
    label.append(input,document.createTextNode(name));$('platform-options').append(label);
    const setting=node('label',`คำชวนซื้อสำหรับ ${name}`), field=node('input');field.id='channel-'+key;field.maxLength=300;
    field.placeholder='เช่น ดูสินค้าที่ตะกร้า (เฉพาะโพสต์ที่ติดสินค้าแล้ว)';setting.append(field);$('platform-settings').append(setting);
  }
  function clearVideo() { if(videoUrl) URL.revokeObjectURL(videoUrl);videoUrl='';$('video-preview').pause();$('video-preview').removeAttribute('src');$('video-preview').load();$('video-preview').hidden=true;$('video-file').value=''; }
  function showReferences() {
    const p=products.find(p=>p.id===project.productId);
    const urls=[...new Set([...(p?.images || []),p?.imageUrl,...project.brief.references].map(C.safeUrl).filter(Boolean))];
    const container=$('reference-images');container.replaceChildren();
    for (const [index,url] of urls.entries()) {
      const label=node('label',undefined,'studio-image'), input=node('input'), img=node('img');
      input.type='checkbox';input.value=url;input.checked=project.brief.references.includes(url);input.setAttribute('aria-label',`ใช้รูปอ้างอิง ${index+1}`);
      img.src=url;img.alt=`รูปสินค้า ${index+1}`;img.loading='lazy';img.width=104;img.height=104;
      label.append(input,img,node('span',`รูป ${index+1}`));container.append(label);
    }
    if (!urls.length) container.append(node('p','สินค้านี้ไม่มี URL รูปที่ใช้งานได้ กรุณาเลือกสินค้าอื่น','studio-warning'));
    $('product-evidence').textContent=p ? `ข้อมูลอ้างอิง: รายชื่อเพลง ${p.tracklist.length} รายการในไฟล์ · ${p.category || 'ไม่ระบุหมวด'} (ตรวจจำนวนจริงก่อนนำไปกล่าวอ้าง)` : 'เปิดจากไฟล์งานเดิม ไม่พบสินค้าในแค็ตตาล็อกปัจจุบัน';
  }
  function fillForm() {
    $('empty-selection').hidden=!!project;$('brief-form').hidden=!project;$('concepts').hidden=true;
    $('project-heading').textContent=project?.brief.shortName || 'เริ่มจากเลือกสินค้าของคุณ';
    if (!project) { $('scene-list').replaceChildren(node('p','เลือกสินค้าและไอเดียในขั้นตอนแรกก่อน','studio-empty'));$('post-list').replaceChildren();return; }
    const b=project.brief;
    for (const [id,value] of Object.entries({'short-name':b.shortName,audience:b.audience,facts:b.facts,price:b.price,style:b.style,aspect:b.aspect,duration:b.duration,voice:b.voice,continuity:b.continuity})) $(id).value=value;
    $('include-price').checked=b.includePrice;$('facts-confirmed').checked=b.factsConfirmed;
    $('actual-summary').value=project.actual.summary;$('post-hook').value=project.actual.hook;$('goal').value=project.actual.goal;$('posts-confirmed').checked=project.actual.confirmed;
    $('video-name').textContent=project.actual.videoName ? `ไฟล์เดิม: ${project.actual.videoName} · หากต้องการดูอีกครั้งให้แนบไฟล์ใหม่` : '';
    $('store-name').value=project.settings.storeName;$('product-link').value=project.settings.productLink;
    for (const key of Object.keys(C.PLATFORMS)) $('channel-'+key).value=project.settings.channels[key] || '';
    $('platform-options').querySelectorAll('input').forEach(i=>i.checked=project.selectedPlatforms.includes(i.value));
    showReferences();renderScenes();renderPosts();
  }
  async function selectProduct(p) {
    if (dirty && !await ask('งานปัจจุบันยังไม่ได้บันทึก เปลี่ยนสินค้าและทิ้งการแก้ไขที่ยังไม่บันทึกหรือไม่?')) return;
    clearVideo();
    const images=[...new Set([p.imageUrl,...p.images].map(C.safeUrl).filter(Boolean))];
    const tags=p.tags.filter(t=>typeof t==='string'&&!/^(USB|MP3)$/i.test(t));
    project={version:1,id:crypto.randomUUID(),productId:p.id,updatedAt:'',concept:null,scenes:[],posts:[],staleScenes:false,stalePosts:false,
      brief:{shortName:p.name.slice(0,200),audience:tags.length?`คนชอบเพลง${tags.join(' / ')}`:'',facts:tags.length?`แนวเพลง: ${tags.join(' / ')}`:'',price:p.price==null?'':String(p.price),includePrice:false,style:'showcase',aspect:'9:16',duration:24,voice:'voiceover',continuity:'',references:images.slice(0,1),factsConfirmed:false},
      settings:structuredClone(savedSettings), actual:{summary:'',hook:'',goal:'sell',confirmed:false,videoName:''},selectedPlatforms:Object.keys(C.PLATFORMS)};
    project.settings.productLink=`https://btmusicdrive.com/product/${encodeURIComponent(p.slug || p.id)}`;
    fillForm();renderProducts();switchTab('brief');markDirty();notify('เลือกภาพสินค้าและตรวจจุดขายก่อนสร้างไอเดีย');
  }
  function renderProducts() {
    const query=$('product-search').value.trim().toLocaleLowerCase();
    const filtered=products.filter(p=>`${p.name} ${p.category} ${p.tags.join(' ')}`.toLocaleLowerCase().includes(query));
    const list=$('product-list');list.replaceChildren();
    for (const p of filtered) {
      const b=button('',()=>selectProduct(p),'studio-product');b.setAttribute('aria-pressed',String(p.id===project?.productId));
      const url=C.safeUrl(p.imageUrl);if (url){ const img=node('img');img.src=url;img.alt='';img.width=56;img.height=56;img.loading='lazy';b.append(img); }
      b.append(node('span',p.name));list.append(b);
    }
    if (!filtered.length) list.append(node('p','ไม่พบสินค้า ลองใช้คำค้นอื่น','studio-muted'));
  }
  async function loadCatalog() {
    $('reload-catalog').disabled=true;
    try { const res=await fetch('/api/catalog');if(!res.ok)throw new Error();const data=await res.json();products=data.products;
      $('catalog-status').textContent=`${products.length} สินค้า · ข้อมูลจากไฟล์ในเครื่อง`;renderProducts();
    }catch{$('catalog-status').textContent='อ่านข้อมูลสินค้าไม่สำเร็จ กดโหลดข้อมูลใหม่ได้';}
    finally{$('reload-catalog').disabled=false;}
  }
  $('reload-catalog').addEventListener('click',loadCatalog);$('product-search').addEventListener('input',renderProducts);
  $('brief-form').addEventListener('input',e=>{
    if(!project)return;
    if(e.target.id!=='facts-confirmed')$('facts-confirmed').checked=false;
    collect();markDirty();project.staleScenes=project.scenes.length>0;project.stalePosts=project.posts.length>0;
    $('posts-confirmed').checked=false;project.actual.confirmed=false;$('concepts').hidden=true;
  });
  $('brief-form').addEventListener('submit',async e=>{
    e.preventDefault();collect();try{C.validateBrief(project.brief);}catch(err){notify(err.message);return;}
    let ideas;try{ideas=useAI()?await generateAI('concepts'):C.concepts(project.brief);}catch(err){notify(err.message);return;}
    const container=$('concepts');container.replaceChildren();container.hidden=false;
    for (const concept of ideas) {
      const card=node('article',undefined,'studio-concept');card.append(node('h3',concept.title),node('p',concept.description),node('p',`“${concept.hook}”`));
      card.append(button('ใช้ไอเดียนี้ →',async()=>{
        if(project.scenes.length&&!await ask('การเลือกไอเดียจะสร้างฉากใหม่แทนฉากและบทที่แก้ไว้ ต้องการทำต่อหรือไม่?'))return;
        collect();const previousConcept=project.concept;project.concept=concept;
        try{project.scenes=useAI()?await generateAI('scenes'):C.makeScenes(project.brief,concept);}catch(err){project.concept=previousConcept;notify(err.message);return;}
        project.concept=concept;project.staleScenes=false;project.stalePosts=project.posts.length>0;
        if(!project.actual.hook){project.actual.hook=concept.hook;$('post-hook').value=concept.hook;}
        renderScenes();markDirty();switchTab('scenes');notify('สร้างฉากแล้ว ตรวจบทพูดและแนบภาพอ้างอิงใน Flow ทีละฉาก');
      },'studio-button studio-button-primary'));container.append(card);
    }
    container.scrollIntoView({behavior:'smooth',block:'nearest'});
  });
  function editField(labelText,value,onInput,{rows=3,max=12000}={}) {
    const label=node('label',labelText),input=node('textarea');input.rows=rows;input.maxLength=max;input.value=value;
    input.addEventListener('input',()=>{onInput(input.value);markDirty();});label.append(input);return {label,input};
  }
  function renderScenes() {
    const list=$('scene-list');list.replaceChildren();
    if (!project?.scenes.length) {list.append(node('p','ยังไม่มีฉาก เลือกไอเดียจากขั้นตอนวางคลิปก่อน','studio-empty'));return;}
    const overview=node('div',undefined,'studio-concept');
    overview.append(node('h3',`คลิปเดียว ${project.scenes.length*8} วินาที · ทำตามลำดับ 1 → ${project.scenes.length}`),
      node('p','1. สร้างฉากแรกใน Flow ด้วยภาพสินค้า → 2. เก็บเฟรมสุดท้ายของคลิปนั้น → 3. ใช้เป็นภาพเริ่มต้นของฉากถัดไป แล้ววางพรอมต์ฉากถัดไป','studio-muted'),
      node('p','ใช้คนเดิม เสียงเดิม สถานที่เดิม และมุมกล้องเดิมทุกฉาก ตรวจภาพและเสียงที่ได้ก่อนต่อคลิป การเขียนพรอมต์อย่างเดียวไม่รับประกันความต่อเนื่อง','studio-muted'));
    const fullScript=node('p',project.scenes.map(s=>s.speech).filter(Boolean).join(' → '));overview.append(fullScript);
    if(project.scenes.some(s=>!s.prompt.includes('[CONTINUOUS CLIP]')))overview.append(node('p','งานนี้เป็นซีนรูปแบบเดิม กดปุ่มด้านล่างเพื่อเขียนบทและจัดซีนให้ต่อเนื่องใหม่','studio-warning'));
    overview.append(button('จัดบทและซีนใหม่ให้เป็นคลิปเดียว',async()=>{
      collect();try{C.validateBrief(project.brief);}catch(err){notify(err.message);return;}
      if(!await ask('เขียนบทและพรอมต์ใหม่ทั้งคลิปแทนซีนเดิม เพื่อให้เล่าต่อกันหรือไม่?'))return;
      try{project.scenes=useAI()?await generateAI('scenes'):C.makeScenes(project.brief,project.concept);project.staleScenes=false;project.stalePosts=project.posts.length>0;markDirty();renderScenes();notify('จัดซีนใหม่แล้ว อ่านบทจากต้นจนจบก่อนนำไปสร้างใน Flow');}catch(err){notify(err.message);}
    },'studio-button studio-button-primary'));list.append(overview);
    project.scenes.forEach((scene,index)=>{
      const card=node('article',undefined,'studio-scene'), head=node('div',undefined,'studio-section-heading');
      head.append(node('h3',`${index+1}. ${scene.title}`),node('span',`${index*8}–${(index+1)*8} วินาที`,'studio-badge'));card.append(head);
      card.append(node('p',index===0?'ภาพเริ่ม: แนบภาพสินค้าที่เลือก แล้วสร้างฉากแรก':`ภาพเริ่ม: ใช้เฟรมสุดท้ายจากวิดีโอฉาก ${index} เป็นภาพเริ่มต้นใน Flow ห้ามเริ่มจากรูปสินค้าใหม่`,'studio-notice'));
      card.append(node('p',project.brief.voice==='dialogue'?'ภาพจบ: คนเดิมถือสินค้าที่ระดับอก มองกล้อง อยู่ท่าเดิม ค้างภาพครึ่งวินาที':'ภาพจบ: USB และแพ็กเกจอยู่ตำแหน่งเดิม กล้องนิ่ง ค้างภาพครึ่งวินาที','studio-muted'));
      const warning=node('p',scene.speech.length>110?'บทพูดอาจยาวเกินฉากนี้ ควรย่อก่อนนำไปสร้าง':'','studio-warning');
      const prompt=editField('พรอมต์สำหรับ Flow',scene.prompt,v=>{scene.prompt=v;},{rows:8});prompt.input.dataset.field='prompt';
      const speech=editField('บทพูดไทย',scene.speech,v=>{
        scene.speech=v;warning.textContent=v.length>110?'บทพูดอาจยาวเกินฉากนี้ ควรย่อก่อนนำไปสร้าง':'';
        const line=`${project.brief.voice==='dialogue'?'Thai on-camera dialogue':'Thai voiceover'}, spoken naturally: ${JSON.stringify(v)}`;
        const pattern=/^Thai (?:on-camera dialogue|voiceover), spoken naturally: .*$/m;
        if(pattern.test(scene.prompt)){scene.prompt=scene.prompt.replace(pattern,()=>line);prompt.input.value=scene.prompt;}
        else notify('แก้บทพูดแล้ว โปรดแก้ส่วนเสียงพูดในพรอมต์ให้ตรงกันด้วย');
        project.stalePosts=project.posts.length>0;
        fullScript.textContent=project.scenes.map(s=>s.speech).filter(Boolean).join(' → ');
      },{rows:2});speech.input.disabled=project.brief.voice==='none';
      const overlay=editField('ข้อความสำหรับวางตอนตัดต่อ',scene.overlay,v=>{scene.overlay=v;},{rows:2});
      card.append(speech.label,warning);
      const advanced=node('details');advanced.append(node('summary','ดู / แก้พรอมต์และข้อความบนภาพ'),node('p',scene.visual,'studio-muted'),overlay.label,prompt.label);card.append(advanced);
      const refs=node('div',undefined,'studio-reference-links');
      scene.references.forEach((url,i)=>{const a=node('a',`รูปสินค้า ${i+1} ↗`);a.href=C.safeUrl(url);a.target='_blank';a.rel='noopener noreferrer';refs.append(a);});advanced.append(refs,node('p','รูปสินค้าใช้คุมหน้าตาสินค้า ส่วนฉากที่ 2 เป็นต้นไป ให้ใช้เฟรมสุดท้ายจากฉากก่อนเป็นภาพเริ่มต้น','studio-muted'));
      const actions=node('div',undefined,'studio-actions');actions.append(button('คัดลอกพรอมต์',()=>{if(checkScenes())copy(scene.prompt);}),button('เปลี่ยนฉากนี้อีกแบบ',async()=>{
        if(!checkScenes())return;
        if(!await ask('คิดพรอมต์และบทใหม่เฉพาะฉากนี้แทนข้อความเดิมหรือไม่?'))return;
        try{project.scenes[index]=useAI()?(await generateAI('scene',index))[0]:C.makeScene(project.brief,project.concept,index,project.scenes.length,scene.variant+1);}
        catch(err){notify(err.message);return;}
        project.scenes=C.connectScenes(project.brief,project.scenes);project.stalePosts=project.posts.length>0;markDirty();renderScenes();
      }));card.append(actions);list.append(card);
    });
  }
  function checkScenes() {
    collect();if(!project?.scenes.length){notify('สร้างฉากก่อน');return false;}
    if(project.staleScenes){notify('ข้อมูลคลิปเปลี่ยนแล้ว กลับไปเลือกไอเดียและสร้างฉากใหม่ก่อนคัดลอก');return false;}
    return true;
  }
  async function copy(text) {
    try{await navigator.clipboard.writeText(text);notify('คัดลอกแล้ว');}
    catch{notify('เบราว์เซอร์ไม่อนุญาตให้คัดลอกอัตโนมัติ เลือกข้อความในช่องแล้วกด Ctrl+C หรือดาวน์โหลดบท .txt');}
  }
  $('copy-scenes').addEventListener('click',()=>{if(checkScenes())copy(project.scenes.map((s,i)=>`ฉาก ${i+1}\n${s.prompt}\n\nรูปอ้างอิง:\n${s.references.join('\n')}`).join('\n\n---\n\n'));});
  $('to-posts').addEventListener('click',()=>{if(checkScenes())switchTab('posts');});
  $('panel-posts').addEventListener('input',e=>{
    if(!project || e.target.closest('#post-list') || e.target.id==='video-file')return;
    collect();project.stalePosts=project.posts.length>0;markDirty();
  });
  $('save-settings').addEventListener('click',()=>{
    if(!project){notify('เลือกสินค้าก่อนตั้งค่าร้าน');return;}collect();
    try{savedSettings=structuredClone(project.settings);savedSettings.productLink='';localStorage.setItem(SETTINGS_KEY,JSON.stringify(savedSettings));notify('จำชื่อร้านและคำชวนซื้อแล้ว ลิงก์สินค้าจะเปลี่ยนตามสินค้าที่เลือก');}
    catch{notify('บันทึกการตั้งค่าไม่ได้ กรุณาใช้การส่งออกไฟล์งาน');}
  });
  $('generate-posts').addEventListener('click',async()=>{
    if(!project){notify('เลือกสินค้าในขั้นตอนแรกก่อน');return;}collect();
    if(!project.brief.shortName){notify('กรอกชื่อสินค้าในขั้นตอนแรกก่อน');return;}
    if(project.settings.productLink&&!C.safeUrl(project.settings.productLink)){notify('ลิงก์สินค้าต้องขึ้นต้นด้วย https:// หรือ http://');return;}
    let generated;try{generated=C.makePosts(project.brief,project.settings,project.actual,project.selectedPlatforms);}catch(err){notify(err.message);return;}
    if(project.posts.length&&!await ask('สร้างชุดโพสต์ใหม่แทนข้อความเดิมหรือไม่? สถานะและลิงก์โพสต์เดิมจะถูกรีเซ็ตเป็นร่าง'))return;
    if(useAI()){try{generated=await generateAI('posts');}catch(err){notify(err.message);return;}}
    project.posts=generated;project.stalePosts=false;renderPosts();markDirty();notify('สร้างชุดโพสต์แล้ว ตรวจข้อความแต่ละช่องทางก่อนคัดลอก');
  });
  function renderPosts() {
    const list=$('post-list');list.replaceChildren();
    for(const post of project?.posts || []) {
      const card=node('article',undefined,'studio-post');card.append(node('h3',C.PLATFORMS[post.platform]));
      for(const [field,label] of [['title',post.platform==='youtube'?'ชื่อคลิป':'ประโยคเปิด / ชื่อโพสต์'],['cover','ข้อความหน้าปก'],['body','แคปชัน / คำอธิบาย']]){
        const f=editField(label,post[field],v=>{post[field]=v;},{rows:field==='body'?6:2,max:field==='body'?10000:1000});card.append(f.label);
      }
      const row=node('div',undefined,'studio-grid'),statusLabel=node('label','สถานะ'),status=node('select');
      for(const [value,label] of [['draft','ร่าง'],['ready','พร้อมโพสต์'],['posted','โพสต์แล้ว']]){const option=node('option',label);option.value=value;status.append(option);}status.value=post.status;
      status.addEventListener('change',()=>{post.status=status.value;markDirty();});statusLabel.append(status);
      const urlLabel=node('label','ลิงก์โพสต์ที่เผยแพร่แล้ว'),url=node('input');url.type='url';url.placeholder='https://...';url.value=post.url;url.maxLength=2000;
      url.addEventListener('input',()=>{post.url=url.value.trim();markDirty();});urlLabel.append(url);row.append(statusLabel,urlLabel);card.append(row);
      card.append(button('คัดลอกชุดโพสต์นี้',()=>{
        if(project.stalePosts){notify('ข้อมูลเปลี่ยนแล้ว กรุณาตรวจและสร้างชุดโพสต์ใหม่ก่อนคัดลอก');return;}
        copy(`ชื่อ: ${post.title}\nหน้าปก: ${post.cover}\n\n${post.body}`);
      }));list.append(card);
    }
  }
  $('video-file').addEventListener('change',()=>{
    const file=$('video-file').files[0];if(!file)return;
    if(!project){$('video-file').value='';notify('เลือกสินค้าก่อนแนบวิดีโอ');return;}
    if(!file.type.startsWith('video/')){$('video-file').value='';notify('เลือกไฟล์วิดีโอที่เบราว์เซอร์รองรับ');return;}
    clearVideo();videoUrl=URL.createObjectURL(file);$('video-preview').src=videoUrl;$('video-preview').hidden=false;
    project.actual.videoName=file.name;project.actual.confirmed=false;$('posts-confirmed').checked=false;project.stalePosts=project.posts.length>0;
    $('video-name').textContent=`${file.name} · ตัวอย่างในเครื่องเท่านั้น (ไฟล์สำรองจะเก็บชื่อ ไม่เก็บวิดีโอ)`;markDirty();
  });
  $('video-preview').addEventListener('error',()=>{if(videoUrl)notify('เบราว์เซอร์เล่นไฟล์นี้ไม่ได้ ใช้ไฟล์ MP4 ที่รองรับ หรือกรอกสรุปวิดีโอแทน');});
  function renderHistory() {
    $('history-count').textContent=history.length;$('history-list').replaceChildren();
    for(const item of history){
      const b=button('',async()=>{
        if(dirty&&!await ask('เปิดงานที่บันทึกไว้และทิ้งการแก้ไขที่ยังไม่บันทึกหรือไม่?'))return;
        clearVideo();project=structuredClone(item);dirty=false;fillForm();renderProducts();switchTab('brief');$('save-status').textContent='เปิดงานที่บันทึกแล้ว';notify('เปิดงานแล้ว ตรวจข้อมูลปัจจุบันก่อนนำไปใช้');
      },'studio-history-item');b.append(node('strong',item.brief.shortName),node('small',`${item.scenes.length} ฉาก · ${item.posts.filter(p=>p.status==='posted').length}/${item.posts.length} โพสต์แล้ว`));$('history-list').append(b);
    }
    if(!history.length)$('history-list').append(node('p','ยังไม่มีงานที่บันทึก','studio-muted'));
  }
  function validatedSnapshot() {
    collect();if(!project)throw new Error('เลือกสินค้าและเริ่มงานก่อน');
    for(const post of project.posts)if(post.url&&!C.safeUrl(post.url))throw new Error('ลิงก์โพสต์ต้องขึ้นต้นด้วย https:// หรือ http://');
    return C.normalizeProject({...project,updatedAt:new Date().toISOString()});
  }
  $('save-project').addEventListener('click',()=>{
    try{const saved=validatedSnapshot();const updated=[saved,...history.filter(p=>p.id!==saved.id)];localStorage.setItem(HISTORY_KEY,JSON.stringify(updated));history=updated;project.updatedAt=saved.updatedAt;dirty=false;renderHistory();$('save-status').textContent='บันทึกในเบราว์เซอร์นี้แล้ว';notify('บันทึกแล้ว ควรสำรอง JSON หากจะย้ายเครื่องหรือล้างข้อมูลเบราว์เซอร์');}
    catch(err){notify(`${err.name==='QuotaExceededError'?'พื้นที่เบราว์เซอร์เต็ม กรุณาส่งออกไฟล์ JSON':err.message}`);}
  });
  function download(content,type,extension) {
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=`content-${project.id.slice(0,8)}.${extension}`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('export-project').addEventListener('click',()=>{try{download(JSON.stringify(validatedSnapshot(),null,2),'application/json;charset=utf-8','json');notify('ส่งออกไฟล์งานแล้ว เก็บไฟล์นี้เพื่อนำเข้าหรือใช้เป็นข้อมูลสำรอง');}catch(err){notify(err.message);}});
  $('export-text').addEventListener('click',()=>{
    try{const snapshot=validatedSnapshot();if(snapshot.staleScenes||snapshot.stalePosts)throw new Error('มีฉากหรือโพสต์ที่ข้อมูลเปลี่ยนแล้ว กรุณาสร้างใหม่ก่อนส่งออกบท');download(C.asText(snapshot),'text/plain;charset=utf-8','txt');notify('ดาวน์โหลดบทและชุดโพสต์แล้ว');}catch(err){notify(err.message);}
  });
  $('import-project').addEventListener('change',async()=>{
    const file=$('import-project').files[0];if(!file)return;
    try{if(file.size>2*1024*1024)throw new Error('ไฟล์งานต้องมีขนาดไม่เกิน 2 MB');const imported=C.normalizeProject(JSON.parse(await file.text()));
      if(dirty&&!await ask('เปิดไฟล์งานนำเข้าและทิ้งการแก้ไขที่ยังไม่บันทึกหรือไม่?'))return;
      imported.id=crypto.randomUUID();clearVideo();project=imported;fillForm();renderProducts();switchTab('brief');markDirty();notify('นำเข้าเป็นงานใหม่แล้ว กดบันทึกเพื่อเก็บในเบราว์เซอร์นี้');
    }catch(err){notify(`นำเข้าไม่สำเร็จ: ${err.message}`);}finally{$('import-project').value='';}
  });
  $('new-project').addEventListener('click',async()=>{
    if(dirty&&!await ask('เริ่มงานใหม่และทิ้งการแก้ไขที่ยังไม่บันทึกหรือไม่?'))return;
    project=null;dirty=false;clearVideo();fillForm();renderProducts();switchTab('brief');$('save-status').textContent='ยังไม่ได้บันทึก';notify('เลือกสินค้าเพื่อเริ่มงานใหม่');
  });
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  renderHistory();loadCatalog();refreshAI();
})();
