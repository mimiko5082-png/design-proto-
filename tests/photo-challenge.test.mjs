import test from 'node:test';
import assert from 'node:assert/strict';
import { BASHO_TOPICS, dailyTopic } from '../haiku-catalog.js';
import { makeCard } from '../haiku-store.js';
import { photoShareFile } from '../photo-sharing.js';
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
test('every daily photo topic has a modern paraphrase, a photo cue and a distinct Basho original', () => {
  assert.equal(new Set(BASHO_TOPICS.map(t => t.id)).size, BASHO_TOPICS.length);
  for (const topic of BASHO_TOPICS) {
    assert.ok(topic.modern && topic.photoHint); assert.equal(topic.lines.length, 3);
    assert.match(topic.source, /松尾芭蕉/);
  }
});
test('photo challenge preserves modern prompt and original without requiring an AI-created poem', () => {
  const topic = dailyTopic('2026-10-29');
  const card = makeCard({id:'photo-challenge-2026-10-29',topicId:topic.id,topicDay:'2026-10-29',creation:'photo-challenge',image},topic.lines,new Date('2026-10-29T03:00:00Z'));
  assert.equal(card.modern,topic.modern); assert.equal(card.aiLines,null);
  assert.deepEqual(card.lines,topic.lines); assert.equal(card.day,'2026-10-29');
});
test('sharing includes the actual saved photo bytes, not a local-only or invented URL', async () => {
  const file = photoShareFile({image,day:'2026-10-29'});
  assert.equal(file.name,'basho-2026-10-29.png'); assert.equal(file.type,'image/png');
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()),Uint8Array.from(atob(image.split(',')[1]),c=>c.charCodeAt(0)));
  assert.throws(()=>photoShareFile({image:'data:text/html;base64,PGgxPg==',day:'2026-10-29'}));
});

test('daily prompt is stable all day and differs from yesterday through month/year boundaries and leap day', () => {
  let previous;
  for (let i = 0; i < 800; i++) {
    const day = new Date(Date.UTC(2023,11,1) + i * 86400000).toISOString().slice(0,10);
    const topic = dailyTopic(day);
    assert.ok(topic);
    assert.equal(dailyTopic(day), topic);
    if (previous) assert.notEqual(topic.id, previous.id);
    previous = topic;
  }
});

test('expanded anthology topics retain verified originals and source, and cover 60 distinct days', async () => {
  const { readFile } = await import('node:fs/promises');
  const excerpts = JSON.parse(await readFile(new URL('../sources/basho-wikisource-excerpts.json', import.meta.url), 'utf8'));
  assert.equal(BASHO_TOPICS.length, 60);
  assert.equal(excerpts.excerpts.length, 60);
  for (const topic of BASHO_TOPICS) {
    assert.equal(topic.original, excerpts.excerpts.find(item => item.id === topic.id)?.original);
    assert.equal(topic.sourceUrl, 'https://ja.wikisource.org/wiki/芭蕉俳句全集');
  }
  const ids = Array.from({length:60},(_,i)=>dailyTopic(new Date(Date.UTC(2026,9,30)+i*86400000).toISOString().slice(0,10)).id);
  assert.equal(new Set(ids).size,60);
  assert.notEqual(dailyTopic('2026-10-29').id,ids[0]);
  assert.equal(dailyTopic('2026-10-29').id,'basho-samidare');
});
