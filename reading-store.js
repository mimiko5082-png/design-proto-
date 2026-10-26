export const POEMS_KEY = 'basho_composed_tanka_v1';
export const STAGES = [
  { xp: 0, name: 'まなざしの種', message: '言葉との出会いを重ねて、芽吹きを待っています。' },
  { xp: 5, name: '小さな芽', message: '言葉にふれて、芽が出ました。' },
  { xp: 10, name: 'ひらく双葉', message: 'いろんな景色を受けとめています。' },
  { xp: 15, name: '風にゆれる若木', message: '詠んだ短歌が、枝を伸ばしています。' },
  { xp: 20, name: '花咲く木', message: '出会った言葉が、花になりました。' },
  { xp: 25, name: '実りの木', message: '景色と言葉に向き合う時間が、実っています。' },
  { xp: 30, name: 'まなざしの大樹', message: '重ねた短歌が、豊かなまなざしになりました。' },
];
export function japanDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = name => parts.find(part => part.type === name).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function validDay(day) {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
}
export function normalizePoems(value) {
  const ids = new Set();
  return (Array.isArray(value?.poems) ? value.poems : []).filter(poem => {
    if (!poem || typeof poem.id !== 'string' || !poem.id || ids.has(poem.id) || !validDay(poem.day) || typeof poem.text !== 'string' || !poem.text.trim() || poem.text.length > 500) return false;
    ids.add(poem.id);
    return true;
  }).map(({id, day, text}) => ({id, day, text: text.trim()}));
}
export function loadPoems(storage) {
  const raw = storage.getItem(POEMS_KEY);
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.poems)) throw new Error('invalid poem history');
  const poems = normalizePoems(value);
  if (poems.length !== value.poems.length) throw new Error('invalid poem records');
  return poems;
}
export function savePoem(storage, {text, day = japanDay()}) {
  if (typeof text !== 'string' || !text.trim() || text.length > 500 || !validDay(day)) throw new Error('invalid poem');
  text = text.trim();
  const poems = loadPoems(storage);
  if (poems.some(poem => poem.day === day && poem.text === text)) return {poems, added: false};
  const next = [...poems, {id: crypto.randomUUID(), day, text}];
  storage.setItem(POEMS_KEY, JSON.stringify({version: 1, poems: next}));
  return {poems: next, added: true};
}
export function growth(poems) {
  const xp = normalizePoems({ poems }).length;
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
