import test from 'node:test';
import assert from 'node:assert/strict';
import { loadReactions, toggleReaction, addComment, removeComment, namedReactions } from '../friend-reactions.js';
const setup = () => {
  const data = new Map();
  const storage = { getItem:key=>data.get(key)||null, setItem:(key,value)=>data.set(key,value) };
  return {storage,data};
};
const day='2026-10-29', topic='basho-samidare', post='sample-aoi';
test('past UID-only reactions resolve names, keep ownership and never return member credentials',()=>{
 const result=namedReactions({stamps:{heart:{alice:true,bob:true,former:true,off:false}},comments:{new:{author:'bob',name:'投稿時の名前',text:'すてき',createdAt:2},old:{author:'alice',text:'ありがとう',createdAt:1}}},{alice:{name:'自分',invite:'PRIVATE'},bob:{name:'友達 <img src=x>'}},'alice');
 assert.deepEqual(result.stamps.find(item=>item.stamp==='heart'),{stamp:'heart',count:3,members:[{name:'自分',own:true},{name:'友達 <img src=x>',own:false},{name:'名前不明の友達',own:false}]});
 assert.deepEqual(result.mine,['heart']);assert.equal(result.comments[0].name,'自分');assert.equal(result.comments[1].name,'投稿時の名前');
 assert.ok(!JSON.stringify(result).includes('PRIVATE'));assert.ok(!JSON.stringify(result).includes('bob'));assert.equal(result.comments[0].author,undefined);
});
test('each stamp is a local per-photo toggle, isolated by day and topic', () => {
  const {storage}=setup();
  assert.deepEqual(toggleReaction(storage,day,topic,post,'view').stamps,['view']);
  assert.deepEqual(toggleReaction(storage,day,topic,post,'view').stamps,[]);
  toggleReaction(storage,day,topic,post,'same');
  assert.deepEqual(loadReactions(storage,day,topic,'sample-haru').stamps,[]);
  assert.deepEqual(loadReactions(storage,'2026-10-30',topic,post).stamps,[]);
  assert.deepEqual(loadReactions(storage,day,'basho-natsukusa',post).stamps,[]);
});
test('comments persist literal user text, enforce limits, and can be removed', () => {
  const {storage}=setup();
  const value=addComment(storage,day,topic,post,'  <気づき> & 光  ');
  assert.equal(value.comments[0].text,'<気づき> & 光');
  const id=value.comments[0].id;
  assert.equal(loadReactions(storage,day,topic,post).comments.length,1);
  assert.equal(removeComment(storage,day,topic,post,id).comments.length,0);
  for (const text of ['  ','a'.repeat(121),{}]) assert.throws(()=>addComment(storage,day,topic,post,text));
  for(let i=0;i<30;i++) addComment(storage,day,topic,post,'なるほど！');
  assert.throws(()=>addComment(storage,day,topic,post,'31件目'));
});
test('invalid storage, unsupported stamps and quota errors cannot silently overwrite reactions', () => {
  const {storage,data}=setup();
  assert.throws(()=>toggleReaction(storage,day,topic,post,'fake'));
  storage.setItem(`basho_friend_preview_v1:${day}:${topic}:${post}`,'broken');
  assert.throws(()=>loadReactions(storage,day,topic,post));
  assert.equal([...data.values()][0],'broken');
  const quota={getItem:()=>null,setItem:()=>{throw Error('Quota');}};
  assert.throws(()=>toggleReaction(quota,day,topic,post,'same'));
});
