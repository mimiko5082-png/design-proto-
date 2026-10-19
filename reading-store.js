import { poemById } from './tanka-catalog.js';
export const READING_KEY = 'basho_reading_v1';
export const STAGES = [
  { xp: 0, name: 'まなざしの種', message: '一首読むたび、少しずつ育つ。' },
  { xp: 1, name: '小さな芽', message: '言葉にふれて、芽が出ました。' },
  { xp: 3, name: 'ひらく双葉', message: 'いろんな景色を受けとめています。' },
  { xp: 7, name: '風にゆれる若木', message: 'あなたの読書が、枝を伸ばしています。' },
  { xp: 15, name: '花咲く木', message: '出会った言葉が、花になりました。' },
  { xp: 30, name: '実りの木', message: '繰り返し読む時間が、実っています。' },
  { xp: 60, name: 'まなざしの大樹', message: '今日の一首も、新しい葉になります。' },
];
export function japanDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = name => parts.find(part => part.type === name).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function validDay(day) {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
}
export function normalizeReads(value) {
  const seen = new Set();
  return (Array.isArray(value?.reads) ? value.reads : []).filter(read => {
    if (!read || !validDay(read.day) || !poemById(read.poemId)) return false;
    const key = `${read.day}/${read.poemId}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map(({ day, poemId }) => ({ day, poemId }));
}
export function loadReads(storage) {
  const raw = storage.getItem(READING_KEY);
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.reads)) throw new Error('invalid reading history');
  return normalizeReads(value);
}
export function markRead(storage, poemId, now = new Date()) {
  if (!poemById(poemId)) throw new Error('unknown poem');
  const reads = loadReads(storage);
  const day = japanDay(now);
  if (reads.some(read => read.day === day && read.poemId === poemId)) return { reads, added: false };
  const next = [...reads, { day, poemId }];
  storage.setItem(READING_KEY, JSON.stringify({ version: 1, reads: next }));
  return { reads: next, added: true };
}
export function growth(reads) {
  const xp = normalizeReads({ reads }).length;
  let level = STAGES.findLastIndex(stage => xp >= stage.xp);
  return { xp, level, stage: STAGES[level], next: STAGES[level + 1] || null };
}
export function monthCells(month) {
  const [year, m] = month.split('-').map(Number);
  const offset = new Date(Date.UTC(year, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
}
export function shiftMonth(month, delta) {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m - 1 + delta, 1)).toISOString().slice(0, 7);
}
