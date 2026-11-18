import test from 'node:test';
import assert from 'node:assert/strict';
import { BASHO_TOPICS, dailyTopic, seasonOf } from '../haiku-catalog.js';
import { makeCard, normalizeReflection, normalizeCaption } from '../haiku-store.js';
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
  // Dates that were already shown keep their verse.
  assert.equal(dailyTopic('2026-10-29').id,'basho-samidare');
  assert.equal(dailyTopic('2026-10-30').id,'basho-harunare');
  assert.equal(dailyTopic('2026-11-18').id,'basho-minakami');
});

test('from 2026-11-19 the daily verse belongs to the season of its date and a season does not repeat early', () => {
  const day = offset => new Date(Date.UTC(2026,10,19)+offset*86400000).toISOString().slice(0,10);
  const expected = month => month>=3&&month<=5?'spring':month>=6&&month<=8?'summer':month>=9&&month<=11?'autumn':'winter';
  const seen = new Set();
  for (let offset = 0; offset < 366; offset++) {
    const date = day(offset), topic = dailyTopic(date);
    assert.equal(seasonOf(date), expected(Number(date.slice(5,7))), date);
    assert.equal(topic.season, seasonOf(date), `${date} ${topic.id}`);
    seen.add(topic.id);
  }
  assert.equal(seen.size, 60);
  assert.deepEqual(Object.fromEntries(['spring','summer','autumn','winter'].map(season => [season, BASHO_TOPICS.filter(topic => topic.season === season).length])), { spring: 20, summer: 13, autumn: 14, winter: 13 });
  // December shows winter verses, each of the thirteen once before any returns; the new year continues the same run.
  const december = Array.from({ length: 13 }, (_, index) => dailyTopic(`2026-12-${String(index + 1).padStart(2, '0')}`).id);
  assert.equal(new Set(december).size, 13);
  assert.equal(dailyTopic('2026-12-01').id, 'basho-hatsuyuki-suisen');
  assert.equal(dailyTopic('2026-12-14').id, december[0]);
  assert.notEqual(dailyTopic('2026-12-31').id, dailyTopic('2027-01-01').id);
  assert.equal(dailyTopic('2027-01-01').season, 'winter');
  assert.equal(dailyTopic('2027-03-01').season, 'spring');
});

test('optional reflection accepts empty/short notes and validates storage size', () => {
  assert.equal(normalizeReflection(), '');
  assert.equal(normalizeReflection('  いつもの道に、小さな影。\n光もきれい。  '), 'いつもの道に、小さな影。\n光もきれい。');
  assert.equal(normalizeReflection('あ'.repeat(280)).length, 280);
  assert.throws(() => normalizeReflection('あ'.repeat(281)));
  assert.throws(() => normalizeReflection({text:'unexpected'}));
  const topic = dailyTopic('2026-10-29');
  const draft = {id:'photo-challenge-2026-10-29',topicId:topic.id,topicDay:'2026-10-29',creation:'photo-challenge',image};
  assert.equal(makeCard(draft, topic.lines).reflection, '');
  assert.equal(makeCard({...draft,reflection:' 葉っぱの影がきれい '},topic.lines).reflection, '葉っぱの影がきれい');
});

test('photo caption is optional, bounded, and separate from the private reflection', () => {
  assert.equal(normalizeCaption(), '');
  assert.equal(normalizeCaption('  いつもの道  '), 'いつもの道');
  assert.equal(normalizeCaption('あ'.repeat(120)).length,120);
  assert.throws(()=>normalizeCaption('あ'.repeat(121)));
  assert.throws(()=>normalizeCaption({text:'not text'}));
  const topic=dailyTopic('2026-10-29');
  const draft={id:'photo-challenge-2026-10-29',topicId:topic.id,topicDay:'2026-10-29',creation:'photo-challenge',image,reflection:'以前の自分用メモ'};
  const card=makeCard(draft,topic.lines);
  assert.equal(card.caption,''); assert.equal(card.reflection,'以前の自分用メモ');
  assert.equal(makeCard({...draft,caption:'みんなに添えるひとこと'},topic.lines).caption,'みんなに添えるひとこと');
});
