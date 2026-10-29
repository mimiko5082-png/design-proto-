import test from 'node:test';
import assert from 'node:assert/strict';
import { loadReactions, toggleReaction, addComment, removeComment } from '../friend-reactions.js';
const setup = () => {
  const data = new Map();
  const storage = { getItem:key=>data.get(key)||null, setItem:(key,value)=>data.set(key,value) };
  return {storage,data};
};
const day='2026-10-29', topic='basho-samidare', post='sample-aoi';
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
