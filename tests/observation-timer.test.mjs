import test from 'node:test';
import assert from 'node:assert/strict';
import { ObservationTimer } from '../observation-timer.js';
import { makeCard } from '../haiku-store.js';
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
test('observation does not unlock until 30 seconds, including after remount', () => {
 const map=new Map(); const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 let now=Date.parse('2026-10-27T03:00:00Z');
 const timer=new ObservationTimer(storage,()=>now);
 assert.equal(timer.ready(),false); timer.start(); now+=29999;
 assert.equal(timer.ready(),false); assert.equal(timer.remaining(),1);
 const resumed=new ObservationTimer(storage,()=>now);
 assert.equal(resumed.ready(),false); now+=1; assert.equal(resumed.ready(),true);
 assert.equal(resumed.remaining(),0); resumed.reset(); assert.equal(resumed.ready(),false);
});
test('observation resets on the next Japanese date and survives unavailable session storage in memory',()=>{
 const map=new Map();const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 let now=Date.parse('2026-10-27T03:00:00Z'); const t=new ObservationTimer(storage,()=>now);t.start();now+=86400000;
 assert.equal(new ObservationTimer(storage,()=>now).ready(),false);
 const unavailable={getItem(){throw Error();},setItem(){throw Error();}};
 const local=new ObservationTimer(unavailable,()=>now);local.start();now+=30000;assert.equal(local.ready(),true);
});
test('a user-written haiku can be saved without fabricating AI provenance',()=>{
 const draft={id:'user-draft',image,topicId:'basho-shizukasa',topicDay:'2026-10-27',aiLines:null,creation:'user',observed:''};
 const card=makeCard(draft,['閑さや','信号かわる','人の波']);
 assert.equal(card.creation,'user');assert.equal(card.aiLines,null);assert.equal(card.observed,'');assert.equal(card.edited,false);
});
