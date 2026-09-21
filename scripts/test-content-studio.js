'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../content-studio/core');
const { createServer } = require('./content-studio');
const brief = () => ({ shortName:'USB เพลงสามช่า',audience:'คนชอบเพลงสามช่า',facts:'มีรายชื่อเพลง',price:'199',includePrice:false,
  style:'showcase',aspect:'9:16',duration:24,voice:'voiceover',continuity:'เสื้อสีน้ำเงินคนเดิม',references:['https://img.btmusicdrive.com/example.webp'],factsConfirmed:true });
const settings = () => ({ storeName:'BT Music Drive',productLink:'https://btmusicdrive.com/product/test',channels:{tiktok:'สอบถามในแชท',facebook:'',instagram:'ส่งข้อความถึงร้าน',youtube:'',shop:''} });
const actual = () => ({summary:'คลิปโชว์ USB และแพ็กเกจ',hook:'ชอบเพลงสามช่ากันไหม',goal:'sell',confirmed:true,videoName:'คลิปจริง.mp4'});
const draft = () => {const b=brief(),concept=C.concepts(b)[0];return {version:1,id:'project-test',productId:'product-test',brief:b,concept,
  scenes:C.makeScenes(b,concept),posts:C.makePosts(b,settings(),actual(),Object.keys(C.PLATFORMS)),settings:settings(),actual:actual(),selectedPlatforms:Object.keys(C.PLATFORMS),updatedAt:'2026-09-09T00:00:00Z',staleScenes:false,stalePosts:false};};

test('all six styles, lengths and voice modes produce consistent references and total duration',()=>{
  for(const style of Object.keys(C.STYLES))for(const duration of [16,24,32])for(const voice of ['voiceover','dialogue','none']){
    const b={...brief(),style,duration,voice};const scenes=C.makeScenes(b,C.concepts(b)[0]);
    assert.equal(scenes.reduce((n,s)=>n+s.seconds,0),duration);assert.equal(scenes.length,duration/8);
    for(const s of scenes){assert.deepEqual(s.references,b.references);assert.match(s.prompt,/เสื้อสีน้ำเงินคนเดิม/);assert.match(s.prompt,/9:16/);
      assert.equal(s.speech==='',voice==='none');if(voice==='none')assert.doesNotMatch(s.prompt,/Thai voiceover, spoken/);
      assert.doesNotMatch(s.prompt,/199 บาท/);
    }
  }
});
test('requires confirmed facts, valid images, valid settings and opt-in price',()=>{
  assert.throws(()=>C.validateBrief({...brief(),factsConfirmed:false}));
  assert.throws(()=>C.validateBrief({...brief(),references:['javascript:alert(1)']}));
  for(const price of ['',-1,'NaN','Infinity'])assert.throws(()=>C.validateBrief({...brief(),price,includePrice:true}));
  assert.throws(()=>C.validateBrief({...brief(),style:'toString'}));
  const b={...brief(),includePrice:true};assert.match(C.makeScenes(b,C.concepts(b)[0]).at(-1).speech,/199 บาท/);
});
test('single-scene variation changes camera and wording without losing product identity',()=>{
  const b=brief(),concept=C.concepts(b)[0];const a=C.makeScene(b,concept,0,3,0),next=C.makeScene(b,concept,0,3,1);
  assert.notEqual(a.prompt,next.prompt);assert.notEqual(a.speech,next.speech);assert.deepEqual(a.references,next.references);assert.match(next.prompt,/USB เพลงสามช่า/);
});
test('continuous clips share boundary framing, introduce product once and keep CTA short',()=>{
  const b={...brief(),shortName:'USB แฟลชไดร์ฟ - MP3 รวมเพลง 3 ช่าเพื่อชีวิต แฟลชไดร์ฟรวมเพลง',voice:'dialogue',duration:16,includePrice:true};
  const scenes=C.makeScenes(b,C.concepts(b)[0]);
  assert.match(scenes[0].speech,/3 ช่าเพื่อชีวิต/);assert.ok(scenes.every(s=>s.speech.length<90));assert.match(scenes[1].speech,/199 บาท/);
  assert.doesNotMatch(scenes[1].speech,/แฟลชไดร์ฟรวมเพลง/);
  const anchor=C.continuityAnchor(b);
  for(const s of scenes){assert.ok(s.prompt.includes('Required START frame: '+anchor));assert.ok(s.prompt.includes('Required END frame: '+anchor));}
  assert.match(scenes[1].prompt,/actual last frame of segment 1/);
  assert.deepEqual(C.connectScenes(b,scenes),scenes);
});
test('post generation requires actual video summary and review, preserves platform CTA and price toggle',()=>{
  assert.throws(()=>C.makePosts(brief(),settings(),{...actual(),summary:''},['tiktok']));
  assert.throws(()=>C.makePosts(brief(),settings(),{...actual(),confirmed:false},['tiktok']));
  assert.throws(()=>C.makePosts(brief(),settings(),actual(),[]));
  const posts=C.makePosts(brief(),settings(),actual(),Object.keys(C.PLATFORMS));assert.equal(posts.length,5);
  for(const p of posts){assert.match(p.body,/คลิปโชว์ USB และแพ็กเกจ/);assert.doesNotMatch(p.body,/199/);assert.equal(p.status,'draft');}
  assert.match(posts.find(p=>p.platform==='facebook').body,/https:\/\/btmusicdrive.com/);
  assert.doesNotMatch(posts.find(p=>p.platform==='tiktok').body,/https:\/\//);
  assert.match(posts.find(p=>p.platform==='instagram').body,/ส่งข้อความถึงร้าน/);
  for(const p of C.makePosts({...brief(),includePrice:true},settings(),actual(),Object.keys(C.PLATFORMS)))assert.match(p.body,/199 บาท/);
  const engagement=C.makePosts(brief(),settings(),{...actual(),goal:'engage'},['tiktok'])[0];assert.match(engagement.body,/คอมเมนต์/);
});
test('backup roundtrip preserves edited prompts, Thai text, statuses and stale flags',()=>{
  const p=draft();p.scenes[1].prompt='Edited prompt ทดสอบ';p.posts[0].status='posted';p.posts[0].url='https://www.tiktok.com/@example/video/123';p.stalePosts=true;
  const roundtrip=C.normalizeProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(roundtrip,p);
  assert.match(C.asText(roundtrip),/Edited prompt ทดสอบ/);assert.match(C.asText(roundtrip),/คลิปโชว์ USB/);
});
test('backup validation rejects malformed content and removes executable URLs and extra fields',()=>{
  assert.throws(()=>C.normalizeProject({}));
  for(const mutate of [p=>p.version=9,p=>p.brief.style='constructor',p=>p.scenes=Array(5).fill(p.scenes[0]),p=>p.concept=null,p=>p.posts[0].platform='toString',p=>p.posts[0].body='a'.repeat(10001)]){
    const p=draft();mutate(p);assert.throws(()=>C.normalizeProject(p));
  }
  const p=draft();p.settings.productLink='javascript:alert(1)';p.scenes[0].references=['data:text/html,hello'];p.adminPassword='untrusted';
  const valid=C.normalizeProject(p);assert.equal(valid.settings.productLink,'');assert.deepEqual(valid.scenes[0].references,[]);assert.equal(valid.adminPassword,undefined);
  assert.equal(C.safeUrl('https://user:password@example.com/'),'');
});
test('every current catalog product can produce a prompt without inventing a song count or price',()=>{
  const products=JSON.parse(fs.readFileSync(path.join(__dirname,'../products.json'),'utf8'));
  for(const product of products.filter(p=>p.isActive!==false)){
    const b={...brief(),shortName:product.name,references:[product.imageUrl],facts:'',price:String(product.price)};
    const scenes=C.makeScenes(b,C.concepts(b)[0]);assert.ok(scenes[0].prompt.includes(product.name));assert.doesNotMatch(scenes[1].speech.replace(product.name,''),/\d+ เพลง|ราคา/);
  }
});
test('local server serves only studio assets and safe public catalog fields',async t=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const port=server.address().port;
  const request=(url,options={})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:url,...options},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});req.on('error',reject);req.end();});
  for(const route of ['/','/style.css','/core.js','/app.js']){const res=await request(route);assert.equal(res.status,200);assert.ok(res.headers['content-security-policy']);assert.ok(res.body.length>100);}
  const data=await request('/api/catalog');assert.equal(data.status,200);const {products}=JSON.parse(data.body);assert.ok(products.length>0);assert.equal(products[0].description,undefined);assert.equal(products[0].password,undefined);
  for(const route of ['/server/.env','/.env','/package.json','/../server/.env','/%2e%2e/server/.env'])assert.equal((await request(route)).status,404);
  assert.equal((await request('/',{headers:{Host:'evil.example'}})).status,403);
  assert.equal((await request('/api/catalog',{method:'POST'})).status,405);
  assert.equal((await request('/api/ai/generate',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'}})).status,403);
  assert.equal((await request('/api/ai/connect',{method:'POST'})).status,403);
  assert.equal((await request('/',{method:'HEAD'})).body,'');
});
