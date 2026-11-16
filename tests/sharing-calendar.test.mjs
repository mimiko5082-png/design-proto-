import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedPhotoDay, calendarRange, calendarPage, unsharedMonthCards, calendarPosts } from '../sharing-calendar.js';
test('historical photos retain their dates; impossible dates and future posts are rejected',()=>{
  assert.equal(sharedPhotoDay('2024-02-29','2026-11-16'),'2024-02-29');
  assert.equal(sharedPhotoDay('2026-11-16','2026-11-16'),'2026-11-16');
  for(const date of ['2025-02-29','2026-11-17','2026-11-00','bad'])assert.throws(()=>sharedPhotoDay(date,'2026-11-16'));
});
test('calendar bounds and cursors cannot escape the selected month',()=>{
  assert.deepEqual(calendarRange('2026-02'),{first:'2026-02-01',last:'2026-02-31',cursor:null});
  for(const month of ['2026-13','2026-00','2026-2','../groups'])assert.throws(()=>calendarRange(month));
  assert.throws(()=>calendarRange('2026-02',{day:'2026-03-01',id:'post'}));
  assert.throws(()=>calendarRange('2026-02',{day:'2026-02-10',id:'a/b'}));
});
test('month pagination handles same-day friends without duplicates or missing photos',()=>{
  const records=Object.fromEntries(Array.from({length:61},(_,n)=>['2026-11-01_'+String(n).padStart(3,'0'),{day:'2026-11-01',author:'friend'+n}]));
  const first=calendarPage(records);assert.equal(first.posts.length,60);assert.ok(first.nextCursor);
  const next=calendarPage(records,first.nextCursor);assert.equal(next.posts.length,1);assert.equal(next.nextCursor,null);
  assert.equal(new Set([...first.posts,...next.posts].map(p=>p.id)).size,61);
});
test('batch sharing selects only this month and omits photos already shared by me',()=>{
  const cards=[{id:'old',day:'2026-10-31',creation:'photo-challenge',image:'photo'},{id:'new',day:'2026-11-01',creation:'photo-challenge',image:'photo',reflection:'private'},{id:'shared',day:'2026-11-02',creation:'photo-ai',image:'photo'},{id:'future',day:'2026-11-17',creation:'photo-challenge',image:'photo'}];
  const posts=[{day:'2026-11-01',own:false},{day:'2026-11-02',own:true}];
  assert.deepEqual(unsharedMonthCards(cards,'2026-11',posts,'2026-11-16').map(c=>c.id),['new']);
});

test('calendar combines local and friend photos and deduplicates shared own photos without leaking private fields',()=>{
  const cards=[{id:'local',creation:'photo-challenge',day:'2026-11-14',image:'local-photo',reflection:'private',caption:'local caption'}, {id:'shared',creation:'photo-ai',day:'2026-11-15',image:'duplicate-photo'}];
  const posts=[{id:'friend',day:'2026-11-14',own:false}, {id:'own',day:'2026-11-15',own:true}];
  const combined=calendarPosts(cards,posts);
  assert.deepEqual(combined.map(p=>p.id),['friend','own','local:local']);
  assert.equal(combined.filter(p=>p.day==='2026-11-14').length,2);
  assert.equal(combined.at(-1).localOnly,true);
  assert.equal(combined.at(-1).reflection,undefined);
  assert.equal(calendarPosts(cards,[]).length,2);
  assert.equal(cards[0].reflection,'private');
});
