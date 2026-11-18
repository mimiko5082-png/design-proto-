import test from 'node:test';
import assert from 'node:assert/strict';
import { BASHO_TOPICS, FIXED_DAYS, MOON_DAYS, dailyTopic, seasonOf } from '../haiku-catalog.js';
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
  assert.equal(BASHO_TOPICS.length, 366);
  assert.equal(excerpts.excerpts.length, 60);
  assert.equal(excerpts.additions.excerpts.length, 306);
  const sourced = [...excerpts.excerpts, ...excerpts.additions.excerpts];
  for (const topic of BASHO_TOPICS) {
    assert.equal(topic.original, sourced.find(item => item.id === topic.id)?.original, topic.id);
    assert.equal(topic.sourceUrl, 'https://ja.wikisource.org/wiki/芭蕉俳句全集');
    assert.equal(topic.lines.length, 3);
    assert.ok(topic.modern && topic.photoHint, topic.id);
  }
  // Verses added later keep the original spelling, so the three lines are exactly the verse.
  for (const topic of BASHO_TOPICS.slice(60)) assert.equal(topic.lines.join(''), topic.original, topic.id);
  assert.equal(new Set(BASHO_TOPICS.map(topic => topic.original)).size, 366);
  // Dates that were already shown keep their verse.
  assert.equal(dailyTopic('2026-10-29').id,'basho-samidare');
  assert.equal(dailyTopic('2026-10-30').id,'basho-harunare');
  assert.equal(dailyTopic('2026-11-18').id,'basho-minakami');
});

test('from 2026-11-19 the daily verse follows the season, and from 2026-12-01 none returns within the same year', () => {
  const day = (start, offset) => new Date(start + offset * 86400000).toISOString().slice(0,10);
  const expected = month => month>=3&&month<=5?'spring':month>=6&&month<=8?'summer':month>=9&&month<=11?'autumn':'winter';
  assert.deepEqual(Object.fromEntries(['spring','summer','autumn','winter'].map(season => [season, BASHO_TOPICS.filter(topic => topic.season === season).length])), { spring: 92, summer: 91, autumn: 92, winter: 91 });
  // The last autumn days of 2026 still come from the first sixty verses, and early December is unchanged.
  const firstSixty = new Set(BASHO_TOPICS.slice(0, 60).map(topic => topic.id));
  for (let offset = 0; offset < 12; offset++) assert.ok(firstSixty.has(dailyTopic(day(Date.UTC(2026,10,19), offset)).id));
  assert.equal(dailyTopic('2026-11-19').id, 'basho-asagao-mizu');
  assert.equal(dailyTopic('2026-12-01').id, 'basho-hatsuyuki-suisen');
  assert.equal(dailyTopic('2026-12-13').id, 'basho-kamo-ukine');
  // The verse is of the date's season, except the Milky Way verse shown on 七夕.
  for (let offset = 0; offset < 2200; offset++) {
    const date = day(Date.UTC(2026,10,19), offset), topic = dailyTopic(date);
    assert.equal(seasonOf(date), expected(Number(date.slice(5,7))), date);
    if (!date.endsWith('-07-07')) assert.equal(topic.season, seasonOf(date), `${date} ${topic.id}`);
  }
  // No verse appears twice in a calendar year, with and without the moon table, in leap years too.
  for (const year of [2027, 2028, 2029, 2031, 2032, 2033]) {
    const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
    const ids = Array.from({ length: days }, (_, offset) => dailyTopic(day(Date.UTC(year, 0, 1), offset)).id);
    assert.equal(new Set(ids).size, days, String(year));
  }
  // From 2026-12-01 to 2027-11-30 all 365 days differ as well.
  assert.equal(new Set(Array.from({ length: 365 }, (_, offset) => dailyTopic(day(Date.UTC(2026,11,1), offset)).id)).size, 365);
});

test('verses tied to a day appear on that day every year', () => {
  for (const year of [2027, 2028, 2030, 2034]) {
    for (const [monthDay, id] of Object.entries(FIXED_DAYS)) assert.equal(dailyTopic(`${year}-${monthDay}`).id, id, `${year}-${monthDay}`);
  }
  assert.equal(dailyTopic('2026-12-31').id, 'basho-toshikurenu');
  assert.match(dailyTopic('2027-01-01').original, /^元日/);
  assert.match(dailyTopic('2027-03-03').original, /雛/);
  assert.match(dailyTopic('2027-07-07').original, /天の川/);
  // 中秋の名月, 十六夜 and 十三夜 follow the moon table.
  for (const [year, [harvest, thirteenth]] of Object.entries(MOON_DAYS)) {
    assert.equal(dailyTopic(`${year}-${harvest}`).id, 'basho-meigetsu-ike');
    assert.equal(dailyTopic(new Date(Date.parse(`${year}-${harvest}T00:00:00Z`) + 86400000).toISOString().slice(0,10)).id, 'basho-izayoi-ebi');
    assert.equal(dailyTopic(`${year}-${thirteenth}`).id, 'basho-nochi-no-tsuki');
  }
  assert.deepEqual(MOON_DAYS[2027], ['09-15', '10-12']);
  // Every pinned id exists, and outside the table the moon verses still appear once in autumn.
  for (const id of [...Object.values(FIXED_DAYS), 'basho-meigetsu-ike', 'basho-izayoi-ebi', 'basho-nochi-no-tsuki']) assert.ok(BASHO_TOPICS.some(topic => topic.id === id), id);
  const autumn2033 = Array.from({ length: 91 }, (_, offset) => dailyTopic(new Date(Date.UTC(2033,8,1) + offset * 86400000).toISOString().slice(0,10)).id);
  assert.equal(autumn2033.filter(id => id === 'basho-meigetsu-ike').length, 1);
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
