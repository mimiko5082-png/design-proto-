import test from 'node:test';
import assert from 'node:assert/strict';
import { japanDay, markRead, loadReads, growth, monthCells, shiftMonth, READING_KEY } from '../reading-store.js';
function storage() { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key,value) => data.set(key,value) }; }
test('explicit reads persist once per poem per Japanese date; next day counts again', () => {
  const s = storage();
  assert.equal(japanDay(new Date('2026-10-19T15:01:00Z')), '2026-10-20');
  assert.equal(markRead(s, 'hyakunin-1', new Date('2026-10-19T15:01:00Z')).added, true);
  assert.equal(markRead(s, 'hyakunin-1', new Date('2026-10-20T14:59:00Z')).added, false);
  assert.equal(markRead(s, 'hyakunin-2', new Date('2026-10-20T14:59:00Z')).added, true);
  assert.equal(markRead(s, 'hyakunin-1', new Date('2026-10-20T15:01:00Z')).added, true);
  assert.deepEqual(loadReads(s).map(read => read.day), ['2026-10-20','2026-10-20','2026-10-21']);
  assert.equal(growth(loadReads(s)).stage.name, 'ひらく双葉');
});
test('quota failures cannot award growth and unknown poems cannot be recorded', () => {
  const s = storage(); const original = s.setItem;
  s.setItem = () => { throw Error('quota'); };
  assert.throws(() => markRead(s,'hyakunin-1'));
  assert.deepEqual(loadReads(s), []);
  s.setItem = original;
  assert.throws(() => markRead(s,'unknown'));
});
test('corrupt or future history is preserved rather than overwritten', () => {
  const s = storage(); s.setItem(READING_KEY, '{bad');
  assert.throws(() => markRead(s,'hyakunin-1'));
  assert.equal(s.getItem(READING_KEY), '{bad');
  s.setItem(READING_KEY, '{"version":2,"reads":[]}');
  assert.throws(() => loadReads(s));
});
test('invalid dates and duplicate imported records do not inflate growth', () => {
  assert.equal(growth([{day:'2026-02-30',poemId:'hyakunin-1'}, {day:'2026-10-20',poemId:'nope'}]).xp,0);
  const record = {day:'2026-10-20',poemId:'hyakunin-1'};
  assert.equal(growth([record,record]).xp,1);
});
test('calendar handles leap days, weekdays and year rollover', () => {
  const cells = monthCells('2024-02');
  assert.equal(cells[4], '2024-02-01');
  assert.equal(cells.at(-1),'2024-02-29');
  assert.equal(monthCells('2026-02').at(-1),'2026-02-28');
  assert.equal(shiftMonth('2026-12',1),'2027-01');
  assert.equal(shiftMonth('2026-01',-1),'2025-12');
});
