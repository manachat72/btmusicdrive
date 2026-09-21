'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../content-studio/core');
const AI=require('./lib/content-studio-ai');
const product=require('../products.json')[0];
function project(){return {version:1,id:'ai-smoke',productId:product.id,brief:{shortName:'USB MP3 รวมเพลง 3 ช่าเพื่อชีวิต',facts:'แนวเพลง 3 ช่าเพื่อชีวิต',price:String(product.price),includePrice:false,audience:'คนชอบเพลงเพื่อชีวิต',style:'driving',aspect:'9:16',duration:16,voice:'voiceover',continuity:'รถจอดนิ่ง แสงอบอุ่น',references:[product.imageUrl],factsConfirmed:true},concept:null,scenes:[],posts:[],settings:{storeName:'BT Music Drive',productLink:'https://btmusicdrive.com/product/'+product.slug,channels:{}},actual:{summary:'วิดีโอโชว์ USB เพลงสามช่าเพื่อชีวิตในรถที่จอดนิ่ง',hook:'',goal:'sell',confirmed:true},selectedPlatforms:['tiktok','facebook','instagram','youtube','shop']};}
test('AI request requires reviewed product facts and valid scene index',()=>{
  const p=project();p.brief.factsConfirmed=false;
  assert.throws(()=>AI.prepare({task:'concepts',project:p}));
  assert.throws(()=>AI.prepare({task:'scene',project:project(),index:3}));
  assert.throws(()=>AI.prepare({task:'unknown',project:project()}));
});
test('AI output validation rejects missing platforms and fixes references and audio mode',()=>{
  const p=C.normalizeProject(project());
  assert.throws(()=>AI.validateOutput({items:[]},{task:'posts',p}));
  assert.throws(()=>AI.validateOutput({items:[{platform:'toString'}]},{task:'posts',p}));
  p.brief.voice='none';p.scenes=C.makeScenes(p.brief,C.concepts(p.brief)[0]);
  const result=AI.validateOutput({items:[{title:'ฉากใหม่',visual:'Product closeup',speech:'ห้ามใช้เสียงนี้',overlay:'ข้อความ',prompt:'Slow dolly-in'}]},{task:'scene',p,index:0});
  assert.equal(result[0].speech,'');assert.deepEqual(result[0].references,p.brief.references);assert.match(result[0].prompt,/No speech/);
});
test('live local GPT OSS generates concepts, scenes, revision and five social posts',{skip:!process.argv.includes('--live'),timeout:1200000},async()=>{
  const p=project();
  for(const task of ['concepts','scenes','scene','posts']){
    const start=Date.now();
    const result=await AI.generate({task,project:p,index:0,instruction:'เล่าเป็นกันเอง มีเหตุการณ์เล็ก ๆ ที่น่าสนใจ ไม่กล่าวอ้างคุณสมบัติเพิ่ม'});
    console.log(`${task}: ${((Date.now()-start)/1000).toFixed(1)}s, ${result.items.length} items, ${result.model}`);
    if(task==='concepts'){assert.equal(result.items.length,3);p.concept=result.items[0];console.log('Hooks:',result.items.map(v=>v.hook).join(' | '));}
    if(task==='scenes'){p.scenes=result.items;assert.equal(p.scenes.length,2);console.log('Speech:',p.scenes.map(s=>s.speech).join(' | '));}
    if(task==='scene'){p.scenes[0]=result.items[0];assert.equal(result.items.length,1);}
    if(task==='posts'){p.posts=result.items;assert.equal(p.posts.length,5);console.log('TikTok:',p.posts.find(v=>v.platform==='tiktok').body);}
  }
  assert.doesNotThrow(()=>C.normalizeProject(p));
});
test('paid API is explicit, sends only to OpenAI, never exposes stored key, disconnect clears it',async()=>{
  AI.configurePaid({disconnect:true});
  await assert.rejects(()=>AI.generate({task:'concepts',provider:'openai',project:project()}),/API key/);
  const key='sk-test-only-not-a-real-credential';
  const state=AI.configurePaid({model:'gpt-4.1-mini',apiKey:key});assert.equal(state.configured,true);assert.ok(!JSON.stringify(state).includes(key));
  const items=[0,1,2].map(i=>({id:String(i),title:'ไอเดีย '+i,hook:'ชอบเพลงอะไร',description:'แนะนำสินค้า'}));
  let called=0;
  try {
    const result=await AI.generate({task:'concepts',provider:'openai',project:project()},{fetcher:async(url,options)=>{
      called++;assert.equal(url,'https://api.openai.com/v1/chat/completions');assert.equal(options.headers.Authorization,'Bearer '+key);
      const payload=JSON.parse(options.body);assert.equal(payload.store,false);assert.equal(payload.model,'gpt-4.1-mini');assert.equal(payload.response_format.json_schema.strict,true);
      return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({items})}}]})};
    }});
    assert.equal(called,1);assert.equal(result.provider,'openai');assert.ok(!JSON.stringify(result).includes(key));
  }finally{AI.configurePaid({disconnect:true});}
  assert.equal(AI.paidStatus().configured,false);
});
