import test from 'node:test';
import assert from 'node:assert/strict';
import { sharingRequest,expirePublicPhotos } from '../ai-service/sharing.mjs';
import { handleRequest } from '../ai-service/worker.mjs';
import { dailyTopic } from '../haiku-catalog.js';
import { sharingEnvironment } from './helpers/sharing-db.mjs';
const now=Date.parse('2026-11-12T03:00:00Z'),day='2026-11-12';
const alice={id:'a'.repeat(32),token:'A'.repeat(43)},bob={id:'b'.repeat(32),token:'B'.repeat(43)};
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const request=(action,data)=>new Request('https://worker.test/api/sharing/'+action,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://mimiko5082-png.github.io'},body:JSON.stringify(data)});
async function api(env,action,data,time=now){const response=await sharingRequest(request(action,data),env,{'Content-Type':'application/json'},time);return {status:response.status,...await response.json()};}
async function ready(env){for(const [identity,name] of [[alice,'あおい'],[bob,'はる']])assert.equal((await api(env,'profile',{identity,name})).status,200);}
const post=identity=>({identity,day,topicId:dailyTopic(day).id,image,caption:'いつもの道の光',audience:'public'});
test('two people see the same real persisted photo and captions, without exposing tokens',async()=>{
 const env=sharingEnvironment();await ready(env);
 const published=await api(env,'publish',post(alice));assert.equal(published.status,200);
 const feed=await api(env,'feed',{identity:bob});assert.equal(feed.posts.length,1);assert.equal(feed.posts[0].image,image);assert.equal(feed.posts[0].caption,'いつもの道の光');assert.equal(feed.posts[0].name,'あおい');assert.equal(feed.posts[0].own,false);
 assert.doesNotMatch(JSON.stringify(feed),new RegExp(alice.token));assert.doesNotMatch(JSON.stringify(feed),/token_hash|member_id/);
 assert.equal((await api(env,'feed',{identity:alice})).posts[0].own,true);
 assert.equal((await api(env,'feed',{})).posts.length,1);
 await api(env,'publish',{...post(alice),caption:'撮り直しました'});
 assert.equal((await api(env,'feed',{})).posts.length,1);assert.equal((await api(env,'feed',{})).posts[0].caption,'撮り直しました');
});
test('stamps and comments cross identities; retries are idempotent and ownership is enforced',async()=>{
 const env=sharingEnvironment();await ready(env);const {id:photoId}=await api(env,'publish',post(alice));
 for(let n=0;n<2;n++)assert.equal((await api(env,'stamp',{identity:bob,photoId,stamp:'heart',active:true})).status,200);
 const comment={identity:bob,photoId,commentId:'c'.repeat(32),text:'その見方すき'};
 await api(env,'comment',comment);await api(env,'comment',comment);
 const detail=await api(env,'detail',{identity:alice,photoId});assert.equal(detail.stamps[0].count,1);assert.equal(detail.comments.length,1);assert.equal(detail.comments[0].own,false);assert.equal(detail.comments[0].name,'はる');
 await api(env,'delete-comment',{identity:alice,photoId,commentId:comment.commentId});assert.equal((await api(env,'detail',{photoId})).comments.length,1);
 assert.equal((await api(env,'delete',{identity:bob,photoId})).status,403);
 assert.equal((await api(env,'publish',post({...alice,token:bob.token}))).status,401);
 assert.equal((await api(env,'profile',{identity:{...alice,token:bob.token},name:'なりすまし'})).status,403);
 await api(env,'stamp',{identity:bob,photoId,stamp:'heart',active:false});await api(env,'delete-comment',{identity:bob,photoId,commentId:comment.commentId});
 assert.equal((await api(env,'detail',{photoId})).comments.length,0);
 await api(env,'report',{identity:bob,photoId});
 assert.equal((await api(env,'delete',{identity:alice,photoId})).status,200);assert.equal((await api(env,'feed',{})).posts.length,0);assert.equal((await api(env,'detail',{photoId})).status,404);
});
test('date/topic/public-consent/image validation and server configuration failures cannot masquerade as success',async()=>{
 const env=sharingEnvironment();await ready(env);
 for(const change of [{day:'2026-11-11'},{topicId:'invented'},{audience:'private'},{image:'https://evil.test/image'},{caption:'a'.repeat(121)}])assert.ok((await api(env,'publish',{...post(alice),...change})).status>=400);
 env.PUSH_RATE_LIMITER.limit=async()=>({success:false});assert.equal((await api(env,'publish',post(alice))).status,429);
 assert.equal((await api({},'feed',{})).status,503);
 const bad=request('feed',{});bad.headers.set('Origin','https://evil.test');assert.equal((await handleRequest(bad,env)).status,403);
});
test('feed paging has no repeated posts and thirty-day expiry removes public data and reactions',async()=>{
 const env=sharingEnvironment();await ready(env);
 for(let n=0;n<14;n++){const identity={id:n.toString(16).padStart(32,'0'),token:'C'.repeat(43)};await api(env,'profile',{identity,name:'利用者'+n});await api(env,'publish',post(identity),now+n);}
 const page=await api(env,'feed',{});assert.equal(page.posts.length,12);assert.ok(page.nextCursor);
 const next=await api(env,'feed',{cursor:page.nextCursor});assert.equal(next.posts.length,2);assert.equal(next.nextCursor,null);assert.equal(new Set([...page.posts,...next.posts].map(post=>post.id)).size,14);
 await expirePublicPhotos(env,now+31*86400000);assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS n FROM public_photos').get().n,0);
});

test('configuration can be checked directly without opening authenticated feed or write APIs',async()=>{
 const env=sharingEnvironment();
 const response=await handleRequest(new Request('https://worker.test/api/sharing/config'),env);
 assert.equal(response.status,200);assert.equal((await response.json()).audience,'public');
 assert.equal((await handleRequest(new Request('https://worker.test/api/sharing/feed',{method:'POST',body:'{}'}),env)).status,403);
});
