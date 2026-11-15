import test from 'node:test';
import assert from 'node:assert/strict';
import { friendsServerNow } from '../firebase-friends.js';
const serverTime=Date.parse('2026-11-16T00:00:00Z');
function session(offset){
  const db={};
  return {db,dbSDK:{ref(actual,path){assert.equal(actual,db);assert.equal(path,'.info/serverTimeOffset');return path;},async get(){return {val:()=>offset};}}};
}
test('invitation time uses Firebase time even when the device clock is ahead or behind',async()=>{
  for(const skew of [600000,-600000,0]){
    const now=await friendsServerNow(session(-skew),()=>serverTime+skew);
    assert.equal(now,serverTime);
    const expiry=now+7*86400000-60000;
    assert.ok(expiry<=serverTime+7*86400000 && expiry>serverTime);
  }
});
test('missing server time stops invite creation instead of using an unreliable device clock',async()=>{
  for(const offset of [null,undefined,'0',NaN,Infinity])await assert.rejects(friendsServerNow(session(offset)),/サーバーの時刻/);
});
