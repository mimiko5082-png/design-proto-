import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyTopic, topicById, validateHaiku } from '../haiku-catalog.js';
import { makeCard } from '../haiku-store.js';
import { requestHaiku } from '../haiku-service.js';
import { handleRequest } from '../ai-service/worker.mjs';
import { VISION_MODEL } from '../ai-service/free-ai.mjs';
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const topicId = 'basho-shizukasa';
const output = { lines:['閑さや','ひかりのしずく','ひとつ落つ'], observed:'葉と、水滴が見えます。' };
const request = (data, origin='https://mimiko5082-png.github.io') => new Request('https://worker.test/api/images/haiku',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
const env = run => ({ AI:{run},IMAGE_RATE_LIMITER:{limit:async()=>({success:true})} });
test('daily Basho prompt is stable, rotates by Japanese date, and cites an actual original',()=>{
  assert.deepEqual(dailyTopic('2026-10-26'),dailyTopic('2026-10-26'));
  assert.notEqual(dailyTopic('2026-10-26').id,dailyTopic('2026-10-27').id);
  assert.match(dailyTopic('2026-10-26').source,/芭蕉.*おくのほそ道/);
});
test('photo haiku uses vision with a server-selected original and structured creative provenance',async()=>{
  let calls=0;
  const response=await handleRequest(request({image,topicId}),env(async(model,body)=>{
    calls++; assert.equal(model,VISION_MODEL);
    assert.match(body.messages[0].content,/芭蕉の実作/);
    assert.equal(body.messages[1].content[1].image_url.url,image);
    assert.deepEqual(JSON.parse(body.messages[1].content[0].text).original,topicById(topicId).lines);
    return {response:'```json\n'+JSON.stringify(output)+'\n```'};
  }));
  assert.equal(response.status,200); assert.deepEqual(await response.json(),output); assert.equal(calls,1);
});
test('invalid topic, spoofed images, missing bindings and off-origin calls never invoke AI',async()=>{
  const bindings=env(()=>{throw Error('must not call');});
  for(const data of [{image,topicId:'invented'},{image:'data:image/svg+xml;base64,PHN2Zz4=',topicId}]) assert.equal((await handleRequest(request(data),bindings)).status,400);
  assert.equal((await handleRequest(request({image,topicId}),{})).status,503);
  assert.equal((await handleRequest(request({image,topicId},'https://other.test'),bindings)).status,403);
});
test('malformed AI and provider secrets are hidden; free-quota stop remains explicit',async()=>{
  for(const response of ['PRIVATE_INVALID_JSON',JSON.stringify({...output,lines:['only one']}),JSON.stringify({...output,lines:['wrong opening','続き','むすび']})]){
    const result=await handleRequest(request({image,topicId}),env(async()=>({response})));
    assert.equal(result.status,502); assert.doesNotMatch(await result.text(),/PRIVATE|only one/);
  }
  const result=await handleRequest(request({image,topicId}),env(async()=>{throw Object.assign(Error('PRIVATE'),{code:3036});}));
  assert.equal(result.status,429); assert.equal((await result.json()).code,'FREE_QUOTA_EXCEEDED');
});
test('haiku client validates replies and hides upstream error bodies',async()=>{
  const result=await requestHaiku('https://worker.test',image,topicId,{fetcher:async()=>new Response(JSON.stringify(output))});
  assert.deepEqual(result,output);
  for(const status of [404,429,502]) await assert.rejects(requestHaiku('https://worker.test',image,topicId,{fetcher:async()=>new Response('PRIVATE',{status})}),error=>!error.message.includes('PRIVATE'));
  assert.throws(()=>validateHaiku({...output,lines:['a\nb','c','d']}));
});
test('saved card dates are Japan save day, with original AI text and user editing separately preserved',()=>{
  const draft={id:'test-uuid',image,topicId,topicDay:'2026-10-26',aiLines:output.lines,observed:output.observed};
  const edited=['閑さや','小さな光','ひとつ落つ'];
  const card=makeCard(draft,edited,new Date('2026-10-26T15:01:00Z'));
  assert.equal(card.day,'2026-10-27'); assert.equal(card.topicDay,'2026-10-26');
  assert.equal(card.edited,true); assert.deepEqual(card.aiLines,output.lines); assert.deepEqual(card.lines,edited);
  assert.throws(()=>makeCard({...draft,image:'https://private.test'},edited));
});
